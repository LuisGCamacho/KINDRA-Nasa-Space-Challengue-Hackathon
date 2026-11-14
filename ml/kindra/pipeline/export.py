import json
from .config import WEB_DATA
def write_series(df):
    for zid, g in df.groupby("zone_id"):
        rows = [{"t": str(r.t), "raw": int(r.raw), "harm": round(r.harm), "lo": round(r.lo),
                 "hi": round(r.hi), "modis": r.modis, "viirs": r.viirs, "src": r.src,
                 "partial": bool(r.partial)} for r in g.itertuples()]
        p = WEB_DATA/"series"/f"{zid}.json"; p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps({"zoneId": zid, "months": rows}, separators=(",", ":")))
# __main__.py — python -m kindra build
import typer
app = typer.Typer()
@app.command()
def download(): ...      # download_firms.yearly()
@app.command()
def build(): ...         # clean → grid → reference → harmonize → zones → aggregate
@app.command()
def load(): ...          # db_load.load_all() → Postgres (persona 5)
@app.command()
def validate(): ...       # validation.step_test + holdout → web/data/validation.json
@app.command()
def train(): ...         # features → train → predict → web/data/forecast/latest.json
@app.command()
def export(): ...        # export.* → web/data/
if __name__ == "__main__": app()
