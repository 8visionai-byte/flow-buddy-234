import { useApp } from '@/context/AppContext';
import RoleSelector from '@/components/RoleSelector';
import UserDashboard from '@/components/UserDashboard';
import AdminDashboard from '@/components/AdminDashboard';
import KierownikDashboard from '@/components/KierownikDashboard';

const Index = () => {
  const { currentUser } = useApp();

  if (!currentUser) return <RoleSelector />;
  if (currentUser.role === 'admin') return <AdminDashboard />;
  if (currentUser.role === 'kierownik_planu') return <KierownikDashboard />;
  return <UserDashboard />;
};

export default Index;
