import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  useEffect(() => {
    // Example effect: log when the sidebar state changes.
    console.log('Sidebar open state:', isOpen);
  }, [isOpen]);

  const toggleSidebar = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const sidebarItems = useMemo(() => {
    return ['Home', 'Profile', 'Settings'];
  }, []);

  const selectItem = useCallback((item: string) => {
    setSelectedItem(item);
  }, []);

  return (
    <div className={cn("sidebar", { "sidebar-open": isOpen })}>
      <div className="sidebar-header">
        <Button onClick={toggleSidebar}>Toggle Sidebar</Button>
      </div>
      <ul className="sidebar-list">
        {sidebarItems.map(item => (
          <li key={item} onClick={() => selectItem(item)}>
            {item} {selectedItem === item && "(Selected)"}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Sidebar;
