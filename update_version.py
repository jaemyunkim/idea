from datetime import date
from pathlib import Path
import re

VERSION_FILE = Path(__file__).resolve().parent / "version.txt"
VERSION_PATTERN = re.compile(r"^(\d{4})\.(\d{2})\.(\d+)$")


def load_version():
    if not VERSION_FILE.exists():
        return None
    for line in VERSION_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            match = VERSION_PATTERN.match(line)
            if not match:
                raise ValueError(f"Invalid version format: {line}")
            return [int(x) for x in match.groups()]
    return None


def write_version(version):
    comment = "# CalVer: YYYY.WW.Patch\n"
    VERSION_FILE.write_text(comment + "{}.{}.{}\n".format(*version), encoding="utf-8")


def bump_version(prev_version):
    today = date.today()
    iso_year, iso_week, _ = today.isocalendar()
    if prev_version and prev_version[0] == iso_year and prev_version[1] == iso_week:
        return [iso_year, iso_week, prev_version[2] + 1]
    return [iso_year, iso_week, 0]


def main():
    prev = load_version()
    version = bump_version(prev)
    write_version(version)
    print("Updated version:", "{}.{}.{}".format(*version))


if __name__ == "__main__":
    main()
