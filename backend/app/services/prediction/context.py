"""Official aggregate context. Never substitutes a district for an AC estimate."""
import argparse
import hashlib
import json
from pathlib import Path

from app.services.prediction.evidence import connect, dump, normal, utcnow

RELIGION_URL = "https://censusindia.gov.in/nada/index.php/catalog/11394/download/14507/DDW09C-01%20MDDS.XLS"
PCA_URL = "https://censusindia.gov.in/nada/index.php/catalog/6191/download/9268/DDW_PCA0000_2011_Indiastatedist.xlsx"
ALIASES = {"prayagraj": "allahabad", "ayodhya": "faizabad", "amroha": "jyotiba phule nagar",
           "kasganj": "kanshiram nagar", "bhadohi": "sant ravidas nagar bhadohi",
           "barabanki": "bara banki", "raebareli": "rae bareli", "maharajganj": "mahrajganj",
           "lakhimpur kheri": "kheri", "hathras": "mahamaya nagar"}
ALIAS_REFERENCES = {
    "lakhimpur kheri": "https://kheri.nic.in/about-district/",
    "hathras": "https://informatics.nic.in/news/298",
}
REFERENCES = [
    {"title": "ECI official historical election reports", "url": "https://www.eci.gov.in/statistical-reports/",
     "status": "reference_portal_not_row_level_reconciliation"},
    {"title": "Census 2011 religious community table — UP", "url": "https://censusindia.gov.in/nada/index.php/catalog/11394"},
    {"title": "Census 2011 district Primary Census Abstract", "url": "https://censusindia.gov.in/nada/index.php/catalog/6191"},
]
UGC_CONTEXT = {
    "issue": "education / UGC equity regulations",
    "scope": "state_context_not_an_AC_swing",
    "checked_at": "2026-09-24",
    "summary": "The 2026 UGC instrument is a set of regulations, not a bill. It defines discrimination and a grievance process; the claim that a case can be brought without stating any reason is not established by that text. Protests were reported in UP, but their electoral effect is unmeasured.",
    "legal_status_note": "The Supreme Court stayed the regulations in January. August reporting says the Centre was reconsidering them. Later legal developments must be checked before reuse.",
    "sources": [
        {"title": "UGC — notified regulations (primary text)", "url": "https://www.ugc.gov.in/pdfnews/1881254_UGC-Promotion-of-Equity-in-HEIs-Regulations-2026.pdf"},
        {"title": "PTI — reported UP protests, 27 January 2026", "url": "https://theprint.in/india/ugc-guidelines-protestors-burn-effigies-demand-rollback-in-uttar-pradesh/2837860/"},
        {"title": "LiveLaw — reconsideration reported, August 2026", "url": "https://www.livelaw.in/amp/top-stories/ugc-equity-regulations-2026-being-reconsidered-centre-tells-supreme-court-546621"},
    ],
    "party_impact": None,
}


def context_for_seat(district):
    key = ALIASES.get(normal(district), normal(district))
    with connect() as db:
        record = db.execute("SELECT payload FROM context_sources WHERE name=?", (f"district:{key}",)).fetchone()
    return {"district": district, "status": "district_context_only" if record else "unavailable",
            "lookup": {"census_name": key, "method": "name_alias_only_not_boundary_crosswalk" if key != normal(district) else "name_match_only",
                       "alias_reference": ALIAS_REFERENCES.get(normal(district))},
            "demographics": json.loads(record[0]) if record else None, "references": REFERENCES,
            "ugc_context": UGC_CONTEXT,
            "limitations": ["2011 district boundaries and population, not 2027 constituency composition.",
                            "No verified AC boundary crosswalk; not used as model features.",
                            "Detailed caste shares, current income distribution and 2027 population are unavailable.",
                            "Worker participation is not income or unemployment; these are historical population statistics.",
                            "Religion, caste and economic status do not determine an individual's vote."]}


def import_religion(path):
    import pandas as pd
    frame = pd.read_excel(path, header=None)
    if "RELIGIOUS COMMUNITY" not in str(frame.iloc[0, 7]):
        raise ValueError("Unexpected Census C-01 schema")
    groups = ("Hindu", "Muslim", "Christian", "Sikh", "Buddhist", "Jain", "Other religions", "Religion not stated")
    records = []
    for _, row in frame.iterrows():
        if str(row[3]).strip() != "00000" or str(row[4]).strip() != "000000" or row[6] != "Total" or str(row[2]) == "000":
            continue
        population = int(row[7])
        numbers = {group: int(row[10 + i * 3]) for i, group in enumerate(groups)}
        if sum(numbers.values()) != population:
            raise ValueError("Religious community counts do not sum to population")
        name = str(row[5]).replace("District - ", "").strip()
        records.append({"district_2011": name, "district_code_2011": str(row[2]), "year": 2011,
                        "geography": "district_2011", "population": population,
                        "religion_pct": {group: round(count / population * 100, 3) for group, count in numbers.items()},
                        "source_url": RELIGION_URL, "retrieved_at": utcnow(),
                        "source_sha256": hashlib.sha256(Path(path).read_bytes()).hexdigest()})
    if len(records) != 71:
        raise ValueError(f"Expected 71 Census-2011 UP districts; found {len(records)}")
    with connect() as db:
        for item in records:
            db.execute("INSERT OR REPLACE INTO context_sources VALUES (?,?)", (f'district:{normal(item["district_2011"])}', dump(item)))
    print(dump({"official_district_records_imported": len(records), "year": 2011}))


def import_pca(path):
    import pandas as pd
    frame = pd.read_excel(path, dtype={"State": str, "District": str})
    required = {"State", "District", "Level", "TRU", "TOT_P", "P_SC", "P_ST", "P_06", "P_LIT", "TOT_WORK_P"}
    if not required <= set(frame.columns):
        raise ValueError(f"Unexpected PCA schema; missing {sorted(required - set(frame.columns))}")
    selected = frame[(frame.State.str.zfill(2) == "09") & (frame.Level.str.upper() == "DISTRICT") & (frame.TRU == "Total")]
    if len(selected) != 71:
        raise ValueError("Expected 71 UP census districts")
    digest = hashlib.sha256(Path(path).read_bytes()).hexdigest()
    with connect() as db:
        contexts = db.execute("SELECT name,payload FROM context_sources WHERE name LIKE 'district:%'").fetchall()
        codes = {json.loads(payload)["district_code_2011"]: (name, json.loads(payload)) for name, payload in contexts}
        for _, row in selected.iterrows():
            key, context = codes[str(row.District).zfill(3)]
            population = int(row.TOT_P)
            if population != context["population"]:
                raise ValueError("Census tables disagree on district population")
            context["socioeconomic"] = {
                "scheduled_caste_population": round(int(row.P_SC) / population * 100, 3),
                "scheduled_tribe_population": round(int(row.P_ST) / population * 100, 3),
                "literacy_age_7_plus": round(int(row.P_LIT) / (population - int(row.P_06)) * 100, 3),
                "worker_participation": round(int(row.TOT_WORK_P) / population * 100, 3),
            }
            context["socioeconomic_source_url"] = PCA_URL
            context["socioeconomic_source_sha256"] = digest
            context["economic_caveat"] = "Worker participation includes main and marginal workers; it is not income, unemployment, or current employment."
            db.execute("UPDATE context_sources SET payload=? WHERE name=?", (dump(context), key))
    print(dump({"official_pca_districts_imported": len(selected), "year": 2011}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--religion", required=True)
    parser.add_argument("--pca")
    args = parser.parse_args()
    import_religion(args.religion)
    if args.pca:
        import_pca(args.pca)
