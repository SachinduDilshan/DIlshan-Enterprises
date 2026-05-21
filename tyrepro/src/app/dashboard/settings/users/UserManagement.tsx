"use client";

import { useEffect, useState } from "react";
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, serverTimestamp, addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { formatDate } from "@/lib/utils";
import { UserPlus, Shield, Truck, User, AlertTriangle } from "lucide-react";
import type { AppUser, UserRole } from "@/types";

const ROLE_OPTS = [
  { value: "admin",      label: "Admin — full access"       },
  { value: "sales_rep",  label: "Sales rep — invoices & shops" },
  { value: "driver",     label: "Driver — dispatch only"    },
];

const ROLE_META: Record<string, { label: string; variant: "purple"|"info"|"default"; icon: React.ElementType }> = {
  admin:     { label: "Admin",      variant: "purple",  icon: Shield  },
  sales_rep: { label: "Sales rep",  variant: "info",    icon: User    },
  driver:    { label: "Driver",     variant: "default", icon: Truck   },
};

function AddUserModal({ onClose }: { onClose: () => void }) {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [role, setRole]       = useState<UserRole>("sales_rep");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email) { setError("Name and email are required."); return; }
    setSaving(true); setError("");

    try {
      // Call our API route which uses Admin SDK to create the Auth user
      const res = await fetch("/api/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create user.");
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <Card className="w-full max-w-sm rounded-t-3xl md:rounded-2xl">
        <CardHeader
          title="Add staff account"
          action={<button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>}
        />
        <form onSubmit={handleCreate} className="space-y-3">
          <Input label="Full name *" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Kamal Perera" />
          <Input label="Email *" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="kamal@example.com" />
          <Select label="Role *" value={role} onChange={e => setRole(e.target.value as UserRole)} options={ROLE_OPTS} />
          <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2.5 text-xs text-blue-800">
            A temporary password <span className="font-semibold">TyrePro@2024</span> will be set. Ask the staff member to change it after first login.
          </div>
          {error && <div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" type="button" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" type="submit" loading={saving}>Create account</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function UserManagement() {
  const { appUser }             = useAuth();
  const [users, setUsers]       = useState<AppUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "users"), orderBy("createdAt", "asc")),
      snap => {
        setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as AppUser)));
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  async function toggleActive(user: AppUser) {
    setUpdating(user.uid);
    await updateDoc(doc(db, "users", user.uid), {
      active:    !user.active,
      updatedAt: serverTimestamp(),
    });
    setUpdating(null);
  }

  async function changeRole(user: AppUser, newRole: string) {
    setUpdating(user.uid + "-role");
    await updateDoc(doc(db, "users", user.uid), {
      role:      newRole,
      updatedAt: serverTimestamp(),
    });
    setUpdating(null);
  }

  if (appUser?.role !== "admin") {
    return (
      <Card className="flex flex-col items-center py-12 text-center">
        <Shield className="h-10 w-10 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">Admin access required</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-gray-800">Staff accounts ({users.length})</h2>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
          <UserPlus className="h-4 w-4" /> Add staff
        </Button>
      </div>

      {loading && <div className="flex justify-center py-8"><div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" /></div>}

      <div className="space-y-3">
        {users.map(user => {
          const meta = ROLE_META[user.role] ?? ROLE_META.sales_rep;
          const RoleIcon = meta.icon;
          const isMe = user.uid === appUser?.uid;

          return (
            <Card key={user.uid}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-sm font-semibold text-brand-800 flex-shrink-0">
                  {user.displayName?.[0]?.toUpperCase() ?? "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{user.displayName}</p>
                    {isMe && <span className="text-xs text-gray-400">(you)</span>}
                    {!user.active && <Badge variant="danger">Inactive</Badge>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>

                  {/* Role selector */}
                  {!isMe && (
                    <div className="mt-2">
                      <Select
                        value={user.role}
                        onChange={e => changeRole(user, e.target.value)}
                        options={ROLE_OPTS}
                        className="text-xs py-1.5"
                      />
                    </div>
                  )}
                  {isMe && (
                    <div className="mt-2">
                      <Badge variant={meta.variant}>
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {meta.label}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Activate / deactivate — not for self */}
                {!isMe && (
                  <Button
                    size="sm"
                    variant={user.active ? "secondary" : "primary"}
                    loading={updating === user.uid}
                    onClick={() => toggleActive(user)}
                    className="flex-shrink-0"
                  >
                    {user.active ? "Deactivate" : "Activate"}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}