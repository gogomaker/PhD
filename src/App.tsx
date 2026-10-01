import { useIsMobile } from './useIsMobile';
import DesktopShell from './desktop/DesktopShell';
import DayPlanner from './mobile/DayPlanner';

export default function App() {
  return useIsMobile() ? <DayPlanner /> : <DesktopShell />;
}
