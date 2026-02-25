import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { UserRole, ROLE_LABELS } from '@/types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const MANAGED_ROLES: { role: UserRole; label: string }[] = [
  { role: 'klient', label: 'Klienci' },
  { role: 'influencer', label: 'Influencerzy' },
  { role: 'montazysta', label: 'Montażyści' },
  { role: 'kierownik_planu', label: 'Kierownicy Planu' },
];

const TeamManagementDialog = () => {
  const { users, addUser, updateUser, deleteUser } = useApp();
  const [open, setOpen] = useState(false);
  const [addingRole, setAddingRole] = useState<UserRole | null>(null);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleAdd = (role: UserRole) => {
    if (!newName.trim()) return;
    addUser({ name: newName.trim(), role });
    setNewName('');
    setAddingRole(null);
  };

  const handleUpdate = (id: string) => {
    if (!editName.trim()) return;
    updateUser(id, { name: editName.trim() });
    setEditingId(null);
    setEditName('');
  };

  const handleDelete = () => {
    if (deleteConfirm) {
      deleteUser(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  const getUsersForRole = (role: UserRole) => users.filter(u => u.role === role);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            Zespół
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Zarządzanie zespołem</DialogTitle>
            <DialogDescription>Dodawaj, edytuj i usuwaj członków zespołu</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="klient" className="mt-2">
            <TabsList className="w-full">
              {MANAGED_ROLES.map(r => (
                <TabsTrigger key={r.role} value={r.role} className="flex-1 text-xs">
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {MANAGED_ROLES.map(r => (
              <TabsContent key={r.role} value={r.role} className="space-y-3 mt-3">
                {getUsersForRole(r.role).map(user => (
                  <div key={user.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    {editingId === user.id ? (
                      <>
                        <Input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="h-8 flex-1"
                          autoFocus
                          onKeyDown={e => e.key === 'Enter' && handleUpdate(user.id)}
                        />
                        <Button size="sm" variant="ghost" onClick={() => handleUpdate(user.id)}>Zapisz</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Anuluj</Button>
                      </>
                    ) : (
                      <>
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                          {user.name.charAt(0)}
                        </div>
                        <span className="flex-1 text-sm font-medium text-foreground">{user.name}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingId(user.id); setEditName(user.name); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(user.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}

                {addingRole === r.role ? (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder={`Imię nowego ${r.label.slice(0, -1).toLowerCase()}...`}
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      className="h-8 flex-1"
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleAdd(r.role)}
                    />
                    <Button size="sm" onClick={() => handleAdd(r.role)}>Dodaj</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setAddingRole(null); setNewName(''); }}>Anuluj</Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setAddingRole(r.role)}>
                    <Plus className="h-3.5 w-3.5" />
                    Dodaj osobę
                  </Button>
                )}

                {getUsersForRole(r.role).length === 0 && addingRole !== r.role && (
                  <p className="text-center text-xs text-muted-foreground py-4">Brak osób w tej roli</p>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={open => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć osobę?</AlertDialogTitle>
            <AlertDialogDescription>
              Tej akcji nie można cofnąć. Osoba zostanie trwale usunięta z systemu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TeamManagementDialog;
