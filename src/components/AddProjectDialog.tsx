import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';

const AddProjectDialog = () => {
  const { addProject, clients } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const isValid = name.trim().length > 0 && !!selectedClient;

  const handleSubmit = () => {
    if (!isValid || !selectedClient) return;
    addProject({
      name: name.trim(),
      clientId: selectedClient.id,
      clientName: selectedClient.contactName,
      company: selectedClient.companyName,
      clientEmail: selectedClient.email,
      clientPhone: selectedClient.phone,
    });
    setName('');
    setSelectedClientId('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Nowy pomysł
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dodaj nowy pomysł</DialogTitle>
          <DialogDescription>Wybierz klienta i podaj nazwę pomysłu / temat filmu</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="clientSelect">Klient *</Label>
            {clients.length === 0 ? (
              <p className="text-sm text-muted-foreground py-1">Brak zarejestrowanych klientów. Dodaj klienta w panelu „Klienci".</p>
            ) : (
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger id="clientSelect">
                  <SelectValue placeholder="Wybierz klienta..." />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="font-medium">{c.companyName}</span>
                      <span className="text-muted-foreground ml-1">— {c.contactName}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedClient && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
              <p><span className="font-medium text-foreground">{selectedClient.companyName}</span></p>
              {selectedClient.email && <p>Email: {selectedClient.email}</p>}
              {selectedClient.phone && <p>Tel: {selectedClient.phone}</p>}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="projectName">Nazwa pomysłu / temat filmu *</Label>
            <Input
              id="projectName"
              placeholder="np. Jak dbać o zęby?"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Anuluj</Button>
          <Button onClick={handleSubmit} disabled={!isValid}>Utwórz pomysł</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddProjectDialog;
