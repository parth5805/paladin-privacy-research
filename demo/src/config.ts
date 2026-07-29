/**
 * Cluster connection config for the demo.
 * Assumes 3 Paladin nodes reachable on localhost at the standard dev-cluster ports.
 * (These are the defaults set by paladin-kind.yaml — no changes needed if you followed the README.)
 */
import { PaladinConfig } from "@lfdecentralizedtrust/paladin-sdk";

export interface NodeConnection {
  name: string;
  id: string;
  clientOptions: PaladinConfig;
}

export const nodeConnections: NodeConnection[] = [
  { name: "Node 1", id: "node1", clientOptions: { url: "http://127.0.0.1:31548" } },
  { name: "Node 2", id: "node2", clientOptions: { url: "http://127.0.0.1:31648" } },
  { name: "Node 3", id: "node3", clientOptions: { url: "http://127.0.0.1:31748" } },
];
