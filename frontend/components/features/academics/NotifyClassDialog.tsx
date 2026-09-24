"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FormModal } from "@/components/forms/FormModal";
import { NativeSelect } from "@/components/forms/NativeSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toApiError } from "@/lib/api/client";
import { classNotifyApi } from "@/lib/api/profile";

interface Props {
  cls: { id: string; name: string; sections: { id: string; name: string }[] } | null;
  onClose: () => void;
}

/** Send a message to every active student of a class (or one section): platform notification plus email. */
export function NotifyClassDialog({ cls, onClose }: Props) {
  const [sectionId, setSectionId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { if (cls) { setSectionId(""); setSubject(""); setMessage(""); } }, [cls]);

  const send = useMutation({
    mutationFn: () => classNotifyApi.send(cls!.id, { sectionId: sectionId || undefined, subject, message }),
    onSuccess: (r) => {
      toast.success(r.students ? `Sent to ${r.students} student${r.students === 1 ? "" : "s"}` : "No active students in this class yet");
      onClose();
    },
    onError: (e) => toast.error(toApiError(e).message),
  });

  return (
    <FormModal open={!!cls} onOpenChange={(o) => !o && onClose()} title={cls ? `Message ${cls.name} students` : "Message students"}
      description="Students get a notification in the platform and an email.">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
        {!!cls?.sections.length && (
          <div className="space-y-1.5">
            <Label htmlFor="nc-section">Send to</Label>
            <NativeSelect id="nc-section" placeholder="All sections" value={sectionId} onChange={(e) => setSectionId(e.target.value)}
              options={cls.sections.map((s) => ({ value: s.id, label: `Section ${s.name}` }))} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="nc-subject">Subject</Label>
          <Input id="nc-subject" required maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nc-message">Message</Label>
          <Textarea id="nc-message" required maxLength={2000} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={send.isPending || !subject.trim() || !message.trim()}>{send.isPending ? "Sending…" : "Send to students"}</Button>
        </div>
      </form>
    </FormModal>
  );
}
