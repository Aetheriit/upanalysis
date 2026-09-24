"""Versioned party classes, not alliance blocs. Allies remain in IPT."""
PARTIES = ("BJP", "SP", "BSP", "RLD", "INC", "IPT")
PARTY_MAPPING_VERSION = "party-classes-v2-no-alliance-pooling"


def normalize_party(value):
    value = (value or "IPT").strip().upper()
    aliases = {"BHARATIYA JANATA PARTY": "BJP", "SAMAJWADI PARTY": "SP",
               "BAHUJAN SAMAJ PARTY": "BSP", "INDIAN NATIONAL CONGRESS": "INC",
               "RASHTRIYA LOK DAL": "RLD"}
    return value if value in PARTIES else aliases.get(value, "IPT")
