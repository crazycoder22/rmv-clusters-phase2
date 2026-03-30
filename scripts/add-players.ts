import { prisma } from "../src/lib/prisma";

const MATCH_ID = "cmncz5gsw000104johalqaqxf";

const players = [
  { name: "Rajat Patidar",    role: "BATSMAN" },
  { name: "Devdutt Padikkal", role: "BATSMAN" },
  { name: "Virat Kohli",      role: "BATSMAN" },
  { name: "Jordan Cox",       role: "BATSMAN" },
  { name: "Phil Salt",        role: "WICKETKEEPER" },
  { name: "Jitesh Sharma",    role: "WICKETKEEPER" },
  { name: "Krunal Pandya",    role: "ALLROUNDER" },
  { name: "Swapnil Singh",    role: "ALLROUNDER" },
  { name: "Tim David",        role: "ALLROUNDER" },
  { name: "Romario Shepherd", role: "ALLROUNDER" },
  { name: "Jacob Bethell",    role: "ALLROUNDER" },
  { name: "Venkatesh Iyer",   role: "ALLROUNDER" },
  { name: "Satvik Deswal",    role: "ALLROUNDER" },
  { name: "Mangesh Yadav",    role: "ALLROUNDER" },
  { name: "Vicky Ostwal",     role: "ALLROUNDER" },
  { name: "Vihaan Malhotra",  role: "ALLROUNDER" },
  { name: "Kanishk Chouhan",  role: "ALLROUNDER" },
  { name: "Josh Hazlewood",   role: "BOWLER" },
  { name: "Rasikh Dar",       role: "BOWLER" },
  { name: "Suyash Sharma",    role: "BOWLER" },
  { name: "Bhuvneshwar Kumar",role: "BOWLER" },
  { name: "Nuwan Thushara",   role: "BOWLER" },
  { name: "Abhinandan Singh", role: "BOWLER" },
  { name: "Jacob Duffy",      role: "BOWLER" },
  { name: "Yash Dayal",       role: "BOWLER" },
];

async function main() {
  const created = await prisma.fantasyPlayer.createMany({
    data: players.map((p) => ({ ...p, matchId: MATCH_ID })),
    skipDuplicates: true,
  });
  console.log(`✅ Added ${created.count} players to match ${MATCH_ID}`);
  await prisma.$disconnect();
}

main();
