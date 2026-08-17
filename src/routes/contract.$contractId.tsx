import { createFileRoute, Link } from "@tanstack/react-router";
...
export const Route = createFileRoute("/contract/$contractId")({
  component: ContractDetailPage,
});
