import Image from "next/image";
import DoAccountStatus from "./components/DoAccountStatus";
import CreateDroplet from "./components/CreateDroplet";
import AMDGPUDroplet from "./components/AMDGPUDroplet";
import CreateDropletPoll from "./components/CreateDropletPoll";
import CD2 from "./components/CD2";
//import SshIntoDroplet from "./components/SshIntoDroplet";
import ListDroplets from "./components/ListDroplets";
import SshTerminal from "./components/SshTerminal";

export default function Home() {
  return (
    <main>
      <h1>DigitalOcean Account Status</h1>
      <DoAccountStatus />
      <CreateDroplet />
      <AMDGPUDroplet />
      <ListDroplets />
      <CreateDropletPoll />
      {/* <SshTerminal /> */}
      {/* <SshIntoDroplet /> */}
      <CD2 />
    </main>
  );
}
