import { useEffect, useState } from "react";
import { openChat } from "@/v2/chat/dock";
import { Button, Modal, Textarea } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { tokenManager } from "@/services/tokenManager";
import type { NeedsItem } from "../types";
import { Icon } from "../parent/Icon";

/** Fetch an authed image through the proxy and expose it as a blob URL. */
export function useAuthImage(path: string | null | undefined) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    let url: string | null = null;
    let live = true;
    const token = tokenManager.getAccessToken();
    fetch(`/api/proxy${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("photo"))))
      .then((b) => {
        url = URL.createObjectURL(b);
        if (live) setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);
  return src;
}

/** Full-screen (phones) photo with Approve / Send back; sending back needs a note. */
export function PhotoViewer({
  item,
  onClose,
  onApprove,
  onSendBack,
}: {
  item: NeedsItem | null;
  onClose: () => void;
  onApprove: (id: number) => void;
  onSendBack: (id: number, note: string) => void;
}) {
  const [note, setNote] = useState("");
  const phone = useMediaQuery("(max-width: 768px)");
  const src = useAuthImage(item?.thumb_url?.replace(/\/thumb$/, ""));
  const close = () => {
    setNote("");
    onClose();
  };
  return (
    <Modal
      opened={!!item}
      onClose={close}
      zIndex={400}
      fullScreen={!!phone}
      transitionProps={{ duration: 0 }}
      title={item ? `${item.kid_name ?? "A kid"} · ${item.title}` : ""}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={item?.title ?? "Chore photo"} style={{ width: "100%", borderRadius: 6 }} />
      )}
      <Textarea
        label="Note for sending back"
        value={note}
        onChange={(e) => setNote(e.currentTarget.value)}
        maxLength={500}
        mt="sm"
      />
      <div className="f-row" style={{ marginTop: 12 }}>
        <Button
          onClick={() => {
            if (item) onApprove(item.id);
            close();
          }}
        >
          Approve
        </Button>
        <Button
          variant="default"
          disabled={!note.trim()}
          onClick={() => {
            if (item) onSendBack(item.id, note.trim());
            close();
          }}
        >
          Send back
        </Button>
        {item && (
          <Button
            variant="subtle"
            leftSection={<Icon name="chat" size={17} />}
            onClick={() => {
              openChat("chore", String(item.id), { label: "Photo" }); // text-only reply: the API takes chat photos, not proof
              close();
            }}
          >
            Reply
          </Button>
        )}
      </div>
    </Modal>
  );
}
