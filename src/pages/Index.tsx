import { useApp } from '@/context/AppContext';
import RoleSelector from '@/components/RoleSelector';
import UserDashboard from '@/components/UserDashboard';
import AdminDashboard from '@/components/AdminDashboard';

const Index = () => {
  const { currentUser } = useApp();

  if (!currentUser) return <RoleSelector />;
  if (currentUser.role === 'admin') return <AdminDashboard />;
  return <UserDashboard />;
};

export default Index;
