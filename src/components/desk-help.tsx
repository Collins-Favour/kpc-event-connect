import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createDeskTicket } from "@/lib/support.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LifeBuoy } from "lucide-react";
import { toast } from "sonner";

/** Always-available help button for people working a registration desk. */
export function DeskHelp({ sessionId, secret }: { sessionId: string; secret: string }) {
  const helpFn = useServerFn(createDeskTicket);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const send = useMutation({
    mutationFn: () => helpFn({ data: { sessionId, secret, subject, body } }),
    onSuccess: () => {
      toast.success("Your space admin has been notified.");
      setSubject("");
      setBody("");
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 h-12 rounded-full shadow-lg transition-transform duration-200 hover:scale-105"
      >
        <LifeBuoy className="size-5" />
        Need help?
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ask your space admin</DialogTitle>
            <DialogDescription>
              Send a question from this desk. Your admin sees it with the event and desk attached.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="help-subject">What do you need?</Label>
              <Input
                id="help-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. A guest's phone number is already used"
              />
            </div>
            <div>
              <Label htmlFor="help-body">Details</Label>
              <Textarea
                id="help-body"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="h-11 w-full"
              onClick={() => send.mutate()}
              disabled={send.isPending || subject.trim().length < 3 || body.trim().length < 5}
            >
              Send to admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
