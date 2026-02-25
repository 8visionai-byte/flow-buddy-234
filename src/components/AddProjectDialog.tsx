import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';

const AddProjectDialog = () => {
  const { addProject } = useApp();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    clientName: '',
    company: '',
    clientEmail: '',
    clientPhone: '',
  });

  const isValid = form.name.trim().length > 0 && form.clientName.trim().length > 0 && form.clientEmail.trim().length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    addProject(form);
    setForm({ name: '', clientName: '', company: '', clientEmail: '', clientPhone: '' });
    setOpen(false);
  };

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Nowy projekt
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dodaj nowy projekt</DialogTitle>
          <DialogDescription>Uzupełnij dane klienta i nazwę projektu</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="projectName">Nazwa projektu / temat filmu *</Label>
            <Input id="projectName" placeholder="np. Jak dbać o zęby?" value={form.name} onChange={e => update('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="clientName">Imię klienta *</Label>
              <Input id="clientName" placeholder="np. Anna" value={form.clientName} onChange={e => update('clientName', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company">Firma</Label>
              <Input id="company" placeholder="np. Dental Care" value={form.company} onChange={e => update('company', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="clientEmail">Email klienta *</Label>
              <Input id="clientEmail" type="email" placeholder="anna@firma.pl" value={form.clientEmail} onChange={e => update('clientEmail', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clientPhone">Telefon</Label>
              <Input id="clientPhone" type="tel" placeholder="+48 600 000 000" value={form.clientPhone} onChange={e => update('clientPhone', e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Anuluj</Button>
          <Button onClick={handleSubmit} disabled={!isValid}>Utwórz projekt</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddProjectDialog;
