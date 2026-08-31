import fs from 'fs';

async function main() {
  const [res17, res22] = await Promise.all([
    fetch("https://upanalysis.onrender.com/api/v1/analytics/constituencies?election_year=2017"),
    fetch("https://upanalysis.onrender.com/api/v1/analytics/constituencies?election_year=2022")
  ]);
  const data17 = await res17.json();
  const data22 = await res22.json();

  function processData(data) {
    const districtMap = {};
    data.constituencies.forEach(c => {
      if (!districtMap[c.district]) {
        districtMap[c.district] = { bjp: 0, sp: 0, bsp: 0, inc: 0, rld: 0, oth: 0, winner: "OTH" };
      }
      const d = districtMap[c.district];
      const w = c.winner_party ? c.winner_party.toLowerCase() : "oth";
      if (w === "bjp" || w === "sp" || w === "bsp" || w === "inc" || w === "rld") {
        d[w] += 1;
      } else {
        d["oth"] += 1;
      }
    });

    for (const dist in districtMap) {
      let maxSeats = -1;
      let maxParty = "OTH";
      for (const p of ["bjp", "sp", "bsp", "inc", "rld", "oth"]) {
        if (districtMap[dist][p] > maxSeats) {
          maxSeats = districtMap[dist][p];
          maxParty = p.toUpperCase();
        }
      }
      districtMap[dist].winner = maxParty;
    }
    return districtMap;
  }

  const result = {
    "2017": processData(data17),
    "2022": processData(data22)
  };

  fs.writeFileSync("map_data.json", JSON.stringify(result, null, 2));
  console.log("map_data.json written!");
}

main();
