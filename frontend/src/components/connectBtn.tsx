import { ConnectButton } from "thirdweb/react";
import { client } from "../lib/client";

export default function Home() {
  return (
    <main>
      <ConnectButton client={client} />
    </main>
  );
}
