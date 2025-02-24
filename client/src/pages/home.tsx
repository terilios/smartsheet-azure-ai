import { Split } from "@geoffcox/react-splitter";
import ChatInterface from "../components/chat/chat-interface";
import SmartsheetFrame from "../components/smartsheet/smartsheet-frame";

export default function Home() {
  return (
    <div className="h-screen w-full">
      <Split initialPrimarySize="400px" minPrimarySize="250px" minSecondarySize="30%">
        <div className="h-full overflow-auto bg-background p-4">
          <ChatInterface />
        </div>
        <div className="h-full overflow-auto bg-background">
          <SmartsheetFrame />
        </div>
      </Split>
    </div>
  );
}
