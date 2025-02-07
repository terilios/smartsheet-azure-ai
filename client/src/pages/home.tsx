import { Split } from "@geoffcox/react-splitter";
import ChatInterface from "@/components/chat/chat-interface";
import SmartsheetFrame from "@/components/smartsheet/smartsheet-frame";

export default function Home() {
  return (
    <div className="h-screen w-full">
      <Split initialPrimarySize="40%" minPrimarySize="30%" minSecondarySize="30%">
        <div className="h-full bg-background p-4">
          <ChatInterface />
        </div>
        <div className="h-full bg-background">
          <SmartsheetFrame />
        </div>
      </Split>
    </div>
  );
}
