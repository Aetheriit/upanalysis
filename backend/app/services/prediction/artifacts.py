"""Immutable local model/feature artifacts and code provenance. No remote loading."""
import hashlib
import json
import platform
from importlib.metadata import version
from pathlib import Path

from app.services.prediction.evidence import artifact_dir


def write_features(snapshot):
    content = json.dumps(snapshot, sort_keys=True, default=str, ensure_ascii=False, allow_nan=False).encode()
    digest = hashlib.sha256(content).hexdigest()
    name = f'features-{digest}.json'
    path = artifact_dir() / name
    if path.exists():
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError('Feature artifact digest mismatch')
    else:
        with path.open('xb') as stream:
            stream.write(content)
    return {'filename': name, 'sha256': digest}


def write_model(run_id, bundle):
    import joblib
    name = f'model-{run_id}.joblib'
    path = artifact_dir() / name
    with path.open('xb') as stream:
        joblib.dump(bundle, stream, compress=3)
    return {'filename': name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'format': 'trusted_local_joblib_only', 'python': platform.python_version(),
            'libraries': {name: version(name) for name in ('scikit-learn', 'numpy', 'xgboost', 'scipy', 'joblib')}}


def code_manifest():
    directory = Path(__file__).parent
    files = {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(directory.glob('*.py'))}
    digest = hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest()
    return {'sha256': digest, 'module_sha256': files}
