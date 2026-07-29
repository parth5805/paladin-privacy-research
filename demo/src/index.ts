/*
 * Paladin Privacy Research — runnable demo
 * =========================================
 *
 * Scenario:
 *   ONE Paladin/Besu network with 3 Paladin nodes.
 *   TWO independent projects share the network but must be cryptographically
 *   isolated from each other:
 *      - Project A
 *      - Project B
 *   Each project has TWO privacy groups (modelling two independent smart-contract
 *   deployments per project). Four privacy groups in total.
 *
 *   Six identities are distributed across the 3 nodes with intentional co-tenancy
 *   so we can observe both cross-node and same-node behaviour:
 *
 *      node1: A_user1, A_user2                (both Project A identities)
 *      node2: A_agent,  B_issuer              (cross-project co-tenants)
 *      node3: A_user3,  B_investor            (cross-project co-tenants)
 *
 *   Privacy groups:
 *      Project-A / Group-1  = { A_user1@node1, A_agent@node2 }
 *      Project-A / Group-2  = { A_user3@node3, A_agent@node2 }
 *      Project-B / Group-1  = { B_issuer@node2, B_investor@node3 }
 *      Project-B / Group-2  = { B_issuer@node2, B_investor@node3 }
 *
 * What we prove:
 *   1. Members can read their group's state.
 *   2. Same-node non-members ALSO can read (Paladin v1.0.0 node-level privacy).
 *   3. Non-member nodes cannot read (Paladin's cryptographic isolation).
 *   4. Cross-project visibility occurs when identities from different projects
 *      share a Paladin node — demonstrating why sub-blockchain isolation
 *      requires node-per-tenant deployment today.
 *
 * Output: a coloured truth table showing exactly what each identity can see.
 *
 * Prerequisites:
 *   - Paladin v1.0.0 running with 3 nodes reachable at ports 31548, 31648, 31748.
 *   - See ../README.md for the one-command Helm install.
 */

import PaladinClient, {
  PenteFactory,
} from "@lfdecentralizedtrust/paladin-sdk";
import { nodeConnections } from "./config";
import { newPrivateStorage, PrivateStorage } from "./helpers/storage";

const logger = console;
const LONG_TIMEOUT = 120_000;

// ANSI colour helpers — no dep, no emojis
const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

interface AccessResult {
  identity: string;
  group: string;
  expected: "MEMBER" | "SAME-NODE-AS-MEMBER" | "NON-MEMBER-NODE";
  actual: "read-ok" | "read-blocked" | "error";
  value?: string;
  errMsg?: string;
}

async function tryReadAs(
  contract: PrivateStorage,
  paladinClient: PaladinClient,
  identity: string,
  groupLabel: string,
  expected: AccessResult["expected"],
): Promise<AccessResult> {
  try {
    const res = await contract.using(paladinClient).call({
      from: identity,
      function: "retrieve",
    });
    return {
      identity,
      group: groupLabel,
      expected,
      actual: "read-ok",
      value: (res as any)?.value?.toString?.() ?? JSON.stringify(res),
    };
  } catch (err: any) {
    const msg = err?.message || String(err);
    return {
      identity,
      group: groupLabel,
      expected,
      actual: /PD012502|not found|no contract deployed/i.test(msg) ? "read-blocked" : "error",
      errMsg: msg.split("\n")[0],
    };
  }
}

async function main(): Promise<boolean> {
  logger.log(c.bold(c.cyan("\n=== Paladin Privacy Research — Live Demo ===\n")));
  logger.log("Two projects share one Paladin network. Truth table follows.\n");

  if (nodeConnections.length < 3) {
    logger.error("Need 3 Paladin nodes reachable. Check src/config.ts.");
    return false;
  }

  const clients = nodeConnections.map(n => new PaladinClient(n.clientOptions));
  const [node1, node2, node3] = clients;
  const id1 = nodeConnections[0].id;
  const id2 = nodeConnections[1].id;
  const id3 = nodeConnections[2].id;

  // Identities (six of them, distributed with intentional co-tenancy)
  const [aUser1]    = node1.getVerifiers(`a_user1@${id1}`);
  const [aUser2]    = node1.getVerifiers(`a_user2@${id1}`);
  const [aAgent]    = node2.getVerifiers(`a_agent@${id2}`);
  const [bIssuer]   = node2.getVerifiers(`b_issuer@${id2}`);
  const [aUser3]    = node3.getVerifiers(`a_user3@${id3}`);
  const [bInvestor] = node3.getVerifiers(`b_investor@${id3}`);

  logger.log(c.bold("Identity map:"));
  logger.log(`  ${id1}: a_user1, a_user2                        (both Project A)`);
  logger.log(`  ${id2}: a_agent, b_issuer                       ${c.yellow("(cross-project co-tenants)")}`);
  logger.log(`  ${id3}: a_user3, b_investor                     ${c.yellow("(cross-project co-tenants)")}\n`);

  // Create four privacy groups
  const penteFactory = new PenteFactory(node1, "pente");

  logger.log(c.bold("Creating privacy groups..."));

  const projectAGroup1 = await penteFactory.newPrivacyGroup({
    name: "ProjectA-Group1",
    members: [aUser1, aAgent],
    evmVersion: "shanghai",
    externalCallsEnabled: true,
  }).waitForDeploy(LONG_TIMEOUT);
  if (!projectAGroup1) { logger.error("ProjectA-Group1 creation failed"); return false; }
  logger.log(`  ${c.green("[OK]")} ProjectA-Group1  members: { a_user1@${id1}, a_agent@${id2} }`);

  const projectAGroup2 = await penteFactory.newPrivacyGroup({
    name: "ProjectA-Group2",
    members: [aUser3, aAgent],
    evmVersion: "shanghai",
    externalCallsEnabled: true,
  }).waitForDeploy(LONG_TIMEOUT);
  if (!projectAGroup2) { logger.error("ProjectA-Group2 creation failed"); return false; }
  logger.log(`  ${c.green("[OK]")} ProjectA-Group2  members: { a_user3@${id3}, a_agent@${id2} }`);

  const projectBGroup1 = await penteFactory.newPrivacyGroup({
    name: "ProjectB-Group1",
    members: [bIssuer, bInvestor],
    evmVersion: "shanghai",
    externalCallsEnabled: true,
  }).waitForDeploy(LONG_TIMEOUT);
  if (!projectBGroup1) { logger.error("ProjectB-Group1 creation failed"); return false; }
  logger.log(`  ${c.green("[OK]")} ProjectB-Group1  members: { b_issuer@${id2}, b_investor@${id3} }`);

  const projectBGroup2 = await penteFactory.newPrivacyGroup({
    name: "ProjectB-Group2",
    members: [bIssuer, bInvestor],
    evmVersion: "shanghai",
    externalCallsEnabled: true,
  }).waitForDeploy(LONG_TIMEOUT);
  if (!projectBGroup2) { logger.error("ProjectB-Group2 creation failed"); return false; }
  logger.log(`  ${c.green("[OK]")} ProjectB-Group2  members: { b_issuer@${id2}, b_investor@${id3} }\n`);

  // Deploy a Storage contract into each group. Route each deploy via the client
  // whose local identity is the deployer (Paladin requires `from` to be local).
  logger.log(c.bold("Deploying a Storage contract into each privacy group..."));
  const storeA1 = await newPrivateStorage(projectAGroup1, aUser1, node1);
  const storeA2 = await newPrivateStorage(projectAGroup2, aUser3, node3);
  const storeB1 = await newPrivateStorage(projectBGroup1, bIssuer, node2);
  const storeB2 = await newPrivateStorage(projectBGroup2, bIssuer, node2);
  if (!storeA1 || !storeA2 || !storeB1 || !storeB2) {
    logger.error("Contract deployment failed.");
    return false;
  }
  logger.log(`  ${c.green("[OK]")} Contracts deployed.\n`);

  // Write a distinct value into each contract so we can prove which one we read.
  logger.log(c.bold("Writing distinct secrets into each contract..."));
  await storeA1.using(node1).sendTransaction({ from: aUser1.lookup, function: "store", data: { num: 1111 } })
    .waitForReceipt(LONG_TIMEOUT);
  await storeA2.using(node3).sendTransaction({ from: aUser3.lookup, function: "store", data: { num: 2222 } })
    .waitForReceipt(LONG_TIMEOUT);
  await storeB1.using(node2).sendTransaction({ from: bIssuer.lookup, function: "store", data: { num: 3333 } })
    .waitForReceipt(LONG_TIMEOUT);
  await storeB2.using(node2).sendTransaction({ from: bIssuer.lookup, function: "store", data: { num: 4444 } })
    .waitForReceipt(LONG_TIMEOUT);
  logger.log(`  ${c.green("[OK]")} ProjectA-Group1 = 1111`);
  logger.log(`  ${c.green("[OK]")} ProjectA-Group2 = 2222`);
  logger.log(`  ${c.green("[OK]")} ProjectB-Group1 = 3333`);
  logger.log(`  ${c.green("[OK]")} ProjectB-Group2 = 4444\n`);

  logger.log(c.bold("Attempting reads from every identity against every group..."));

  type GroupSpec = { label: string; contract: PrivateStorage; members: string[] };
  const groups: GroupSpec[] = [
    { label: "ProjectA-Group1", contract: storeA1, members: [`a_user1@${id1}`, `a_agent@${id2}`] },
    { label: "ProjectA-Group2", contract: storeA2, members: [`a_user3@${id3}`, `a_agent@${id2}`] },
    { label: "ProjectB-Group1", contract: storeB1, members: [`b_issuer@${id2}`, `b_investor@${id3}`] },
    { label: "ProjectB-Group2", contract: storeB2, members: [`b_issuer@${id2}`, `b_investor@${id3}`] },
  ];

  const identities: { identity: string; node: string; client: PaladinClient }[] = [
    { identity: `a_user1@${id1}`,    node: id1, client: node1 },
    { identity: `a_user2@${id1}`,    node: id1, client: node1 },
    { identity: `a_agent@${id2}`,    node: id2, client: node2 },
    { identity: `b_issuer@${id2}`,   node: id2, client: node2 },
    { identity: `a_user3@${id3}`,    node: id3, client: node3 },
    { identity: `b_investor@${id3}`, node: id3, client: node3 },
  ];

  const attempts: AccessResult[] = [];
  for (const g of groups) {
    const memberNodes = new Set(g.members.map(m => m.split("@")[1]));
    for (const who of identities) {
      const isMember = g.members.includes(who.identity);
      const nodeHasMember = memberNodes.has(who.node);
      const expected: AccessResult["expected"] = isMember
        ? "MEMBER"
        : nodeHasMember
          ? "SAME-NODE-AS-MEMBER"
          : "NON-MEMBER-NODE";
      attempts.push(await tryReadAs(g.contract, who.client, who.identity, g.label, expected));
    }
  }

  // Truth table
  logger.log(c.bold("\n=== Truth Table ==="));
  logger.log(c.dim("Legend: [M] MEMBER  |  [S] SAME-NODE-AS-MEMBER  |  [N] NON-MEMBER-NODE"));
  logger.log(c.dim("Actual: OK (nnnn) = read succeeded returning secret nnnn, BLOCKED = read failed\n"));

  const header = ["Identity".padEnd(22), ...groups.map(g => g.label.padEnd(20))].join(" | ");
  logger.log(c.bold(header));
  logger.log("-".repeat(header.length));

  for (const who of identities) {
    const row = [who.identity.padEnd(22)];
    for (const g of groups) {
      const r = attempts.find(a => a.identity === who.identity && a.group === g.label)!;
      let cell: string;
      if (r.actual === "read-ok") cell = c.green(`OK (${r.value})`);
      else if (r.actual === "read-blocked") cell = c.yellow("BLOCKED");
      else cell = c.red("ERR");
      const tag = r.expected === "MEMBER" ? "M" : r.expected === "SAME-NODE-AS-MEMBER" ? "S" : "N";
      row.push(`[${tag}] ${cell}`.padEnd(30));
    }
    logger.log(row.join(" | "));
  }

  // Summary
  logger.log(c.bold("\n=== Summary ==="));
  const byCategory = attempts.reduce<Record<string, { total: number; okCount: number }>>((acc, a) => {
    acc[a.expected] = acc[a.expected] || { total: 0, okCount: 0 };
    acc[a.expected].total += 1;
    if (a.actual === "read-ok") acc[a.expected].okCount += 1;
    return acc;
  }, {});
  logger.log(`  MEMBER reads succeeded:              ${byCategory["MEMBER"]?.okCount ?? 0} / ${byCategory["MEMBER"]?.total ?? 0}`);
  logger.log(`  SAME-NODE non-member reads succeeded: ${byCategory["SAME-NODE-AS-MEMBER"]?.okCount ?? 0} / ${byCategory["SAME-NODE-AS-MEMBER"]?.total ?? 0}   ${c.yellow("(node-level privacy — v1.0.0 allows this)")}`);
  const nonMemberBlocked = (byCategory["NON-MEMBER-NODE"]?.total ?? 0) - (byCategory["NON-MEMBER-NODE"]?.okCount ?? 0);
  logger.log(`  NON-MEMBER-NODE reads blocked:        ${nonMemberBlocked} / ${byCategory["NON-MEMBER-NODE"]?.total ?? 0}   ${c.green("(cryptographic isolation)")}`);

  logger.log("");
  logger.log(c.bold("Interpretation"));
  logger.log("  Paladin v1.0.0 enforces privacy at the node level.");
  logger.log("  Identities co-located on a member node share visibility of that group's state.");
  logger.log("  To isolate identities cryptographically today, deploy them on separate nodes.");
  logger.log("  See docs/03-multi-tenant-vision.md for deployment topologies.\n");

  return true;
}

main()
  .then(ok => process.exit(ok ? 0 : 1))
  .catch(e => { console.error(e); process.exit(2); });
