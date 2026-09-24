"""Strict ECI detailed-result PDF importer and prediction-only source overlay.

Poppler text is parsed by printed table columns, including wrapped names.
All 403 ACs, candidate sequences, vote-channel sums and printed totals must
agree before a file can be used. Does not write the shared election tables.
"""
import argparse
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from difflib import SequenceMatcher

from app.services.prediction.parties import PARTIES, normalize_party

ECI_URLS = {
    2017: "https://www.eci.gov.in/eci-backend/public/api/download?url=LMAhAK6sOPBp%2FNFF0iRfXbEB1EVSLT41NNLRjYNJJP1KivrUxbfqkDatmHy12e%2FzVx8fLfn2ReU7TfrqYobgIk%2B0o9SdPlDTb8MxwP6rVC6OhA30eHogh4pDOFiIulVKCFCDV4OXYPVtphZl11RU0Ab9memMGkyg3jvjH4KTFPbdbTRiXXuWJTShPVmismOQ",
    2022: "https://www.eci.gov.in/eci-backend/public/api/download?url=LMAhAK6sOPBp%2FNFF0iRfXbEB1EVSLT41NNLRjYNJJP1KivrUxbfqkDatmHy12e%2FzVx8fLfn2ReU7TfrqYobgItW4eTUyTFD%2BDUyB1G1fBKOuW00SdZqELiEOB05oPhRO74%2F4p%2BuSikD0u7%2BVrCmQyhaJANaxWi%2FXMLUEuMmRVRLJ2%2BdBIBswoUnKE3KB7EMq",
}


def parse_layout(text, year):
    seats, current, candidate, columns = {}, None, None, None
    for page_number, page in enumerate(text.split('\f'), 1):
        for line in page.splitlines():
            line = re.sub(r'\s+Page\s+\d+\s*$', '', line)
            if 'CANDIDATE NAME' in line and 'PARTY' in line:
                # Column boundaries are midpoints between adjacent headings.
                columns = {
                    'name_end': line.index('SEX') - 3,
                    'party_start': (line.index('CATEGORY') + 8 + line.index('PARTY')) // 2,
                    'party_end': (line.index('PARTY') + 5 + line.index('SYMBOL' if year == 2022 else 'GENERAL')) // 2,
                    'votes_start': line.index('GENERAL') - 4,
                }
                continue
            match = re.match(r'\s*Constituency\s+(\d+)\s*\.\s*(.*?)\s+TOTAL ELECTORS\s*:?\s*(\d+)\s*$', line)
            if match:
                code, name, electors = match.groups()
                if code in seats:
                    raise ValueError(f'Duplicate AC {code}')
                current = {'code': code, 'name': name, 'electors': int(electors), 'candidates': [], 'page': page_number}
                seats[code] = current
                candidate = None
                continue
            if current is None or columns is None:
                continue
            if 'TOTAL:' in line:
                if 'votes_total' in current:
                    continue  # State total after the final constituency.
                values = re.findall(r'\d+(?:\.\d+)?', line.split('TOTAL:')[1])
                if len(values) < 3:
                    raise ValueError(f'Missing totals for AC {current["code"]}')
                current['general_total'], current['postal_total'], current['votes_total'] = map(int, values[:3])
                candidate = None
                continue
            left = line[:columns['name_end']].strip()
            first = re.match(r'^(\d+)(?:\s+(.*))?$', left)
            if first:
                candidate = {'rank': int(first[1]), 'name': (first[2] or '').strip(), 'page': page_number}
                current['candidates'].append(candidate)
            elif candidate and left and not any(marker in left for marker in ('Election Commission', 'DETAILED', 'ST8988', 'VALID', 'Page')):
                candidate['name'] += ' ' + left
            if candidate:
                party = line[columns['party_start']:columns['party_end']].strip()
                votes = re.findall(r'\b\d+\b', line[columns['votes_start']:])
                if party and len(votes) >= 3:
                    candidate.update(party=party, general=int(votes[0]), postal=int(votes[1]), total=int(votes[2]))
    validate_seats(seats)
    return seats


def validate_seats(seats):
    if set(seats) != {str(i) for i in range(1, 404)}:
        raise ValueError(f'Expected 403 ECI constituencies, got {len(seats)}')
    for code, seat in seats.items():
        if str(seat.get('code')) != code or not seat.get('name', '').strip():
            raise ValueError(f'Constituency identity mismatch at AC {code}')
        candidates = seat['candidates']
        if [c['rank'] for c in candidates] != list(range(1, len(candidates) + 1)):
            raise ValueError(f'Candidate sequence mismatch at AC {code}: {[c["rank"] for c in candidates]}')
        for c in candidates:
            if not all(key in c for key in ('party', 'general', 'postal', 'total')):
                raise ValueError(f'Incomplete candidate at AC {code}: {c}')
            if not c['name'].strip() or any(type(c[key]) is not int or c[key] < 0 for key in ('general', 'postal', 'total')):
                raise ValueError(f'Invalid candidate name or vote count at AC {code}')
            if c['general'] + c['postal'] != c['total']:
                raise ValueError(f'Vote-channel mismatch at AC {code}: {c}')
        for field, total in (('total', 'votes_total'), ('general', 'general_total'), ('postal', 'postal_total')):
            if sum(c[field] for c in candidates) != seat.get(total):
                raise ValueError(f'{field} total mismatch at AC {code}: {sum(c[field] for c in candidates)} vs {seat.get(total)}')
        if len([c for c in candidates if c['party'] == 'NOTA']) != 1:
            raise ValueError(f'NOTA row missing/duplicated at AC {code}')
        if not 0 < seat['votes_total'] <= seat['electors']:
            raise ValueError(f'Invalid turnout at AC {code}')


def summary(seat):
    candidates = [c for c in seat['candidates'] if c['party'] != 'NOTA']
    ordered = sorted(candidates, key=lambda c: c['total'], reverse=True)
    totals = Counter()
    for candidate in candidates:
        totals[normalize_party(candidate['party'])] += candidate['total']
    valid = sum(totals.values())
    return {'shares': {p: totals[p] / valid for p in PARTIES},
            'winner': normalize_party(ordered[0]['party']), 'actual_winner': ordered[0]['party'],
            'margin': ordered[0]['total'] - ordered[1]['total'], 'total': valid,
            'source': 'eci_detailed_results', 'source_page': seat['page'],
            'turnout': seat['votes_total'] / seat['electors'],
            'nota_share': (seat['votes_total'] - valid) / seat['votes_total']}


def load_sources(directory):
    sources = {}
    for year in (2017, 2022):
        path = Path(directory) / f'eci-up-{year}.json'
        if not path.exists():
            raise ValueError(f'Official ECI source snapshot required for {year}')
        payload = json.loads(path.read_text(encoding='utf-8'))
        if payload.get('year') != year or payload.get('source_url') != ECI_URLS[year]:
            raise ValueError(f'Unexpected official source provenance for {year}')
        validate_seats(payload['seats'])
        payload['snapshot_sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
        sources[year] = payload
    return sources


def name_key(name):
    return ' '.join(re.findall(r'\w+', (name or '').casefold()))


def candidate_crosswalk(candidates, seat):
    """Exact local identity, or exact total + a close name, within one AC/year.

    Unknown/ambiguous candidates are not assigned the incumbent's party.
    Duplicate local IDs can map to one official rank; booth votes are deduped
    independently. No database records are changed.
    """
    mapping, audit = {}, {'mapped': 0, 'unmapped': 0, 'party_conflicts': 0, 'duplicate_ids': 0}
    used = set()
    for local in candidates:
        key = name_key(local.name)
        if key in {'nota', 'none of the above'}:
            options = [c for c in seat['candidates'] if c['party'] == 'NOTA']
        else:
            options = [c for c in seat['candidates'] if name_key(c['name']) == key]
            if not options:
                options = [c for c in seat['candidates'] if c['total'] == local.votes_received
                           and SequenceMatcher(None, key, name_key(c['name'])).ratio() >= .78]
        if len(options) == 1:
            candidate = options[0]
            mapping[str(local.id)] = candidate
            audit['mapped'] += 1
            audit['duplicate_ids'] += int(candidate['rank'] in used)
            used.add(candidate['rank'])
            local_label = normalize_party(local.party.abbreviation if local.party else None)
            audit['party_conflicts'] += int(candidate['party'] != 'NOTA' and local_label != normalize_party(candidate['party']))
        else:
            audit['unmapped'] += 1
    return mapping, audit


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--year', required=True, type=int, choices=(2017, 2022))
    parser.add_argument('--text', required=True, help='Poppler pdftotext -layout output')
    parser.add_argument('--pdf', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    source = Path(args.pdf)
    if not source.read_bytes().startswith(b'%PDF'):
        raise ValueError('Expected the official source PDF')
    seats = parse_layout(Path(args.text).read_text(encoding='utf-8'), args.year)
    payload = {'year': args.year, 'source_url': ECI_URLS[args.year],
               'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
               'retrieved_at': datetime.now(timezone.utc).isoformat(),
               'parser_version': 'eci-layout-v1-strict-totals', 'seats': seats}
    destination = Path(args.output)
    if destination.exists():
        raise ValueError('Refusing to overwrite an existing source snapshot')
    destination.write_text(json.dumps(payload, ensure_ascii=False, allow_nan=False), encoding='utf-8')
    print(json.dumps({'year': args.year, 'constituencies': len(seats), 'candidate_rows': sum(len(s['candidates']) for s in seats.values()),
                      'winner_counts': dict(Counter(summary(s)['actual_winner'] for s in seats.values())),
                      'source_sha256': payload['source_sha256']}))


if __name__ == '__main__':
    main()
