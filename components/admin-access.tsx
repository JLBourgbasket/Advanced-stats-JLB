"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Check, KeyRound, LogOut, Mail, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type AdminAccessProps = {
  onAccessChange: (state: { user: User | null; isAdmin: boolean }) => void;
};

export function AdminAccess({ onAccessChange }: AdminAccessProps) {
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const updateAccess = async (nextUser: User | null) => {
      let admin = false;
      if (nextUser) {
        const { data, error } = await supabase.rpc("is_admin");
        admin = !error && data === true;
      }
      setUser(nextUser);
      setIsAdmin(admin);
      setLoading(false);
      onAccessChange({ user: nextUser, isAdmin: admin });
    };

    void supabase.auth.getUser().then(({ data }) => updateAccess(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void updateAccess(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, [onAccessChange]);

  const sendMagicLink = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !email.trim()) return;
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setLoading(false);
    setMessage(error ? error.message : "Lien envoyé. Vérifiez votre messagerie.");
  };

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    setMessage("Déconnexion effectuée.");
  };

  if (!configured) {
    return <AccessNotice icon={<ShieldAlert />} title="Connexion non configurée" copy="Les variables Supabase ne sont pas disponibles dans ce déploiement." tone="bad" />;
  }

  if (loading) {
    return <div className="border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">Vérification de l’accès…</div>;
  }

  if (user && isAdmin) {
    return (
      <div className="border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><Check className="size-5 text-emerald-700" /><div><div className="font-bold text-emerald-950">Administration active</div><div className="text-xs text-emerald-800">{user.email}</div></div></div>
          <Button variant="outline" onClick={signOut} className="rounded-none bg-white"><LogOut /> Déconnexion</Button>
        </div>
      </div>
    );
  }

  if (user && !isAdmin) {
    return <AccessNotice icon={<ShieldAlert />} title="Compte non autorisé" copy={`${user.email ?? "Cette adresse"} peut consulter les rapports, mais ne peut pas importer de match.`} tone="bad" action={<Button variant="outline" onClick={signOut} className="rounded-none bg-white"><LogOut /> Déconnexion</Button>} />;
  }

  return (
    <div className="border border-stone-200 bg-stone-50 p-4">
      <div className="flex items-start gap-3"><KeyRound className="mt-0.5 size-5 text-[#d71920]" /><div><div className="font-bold">Accès administrateur</div><p className="mt-1 text-sm leading-6 text-stone-500">Recevez un lien sécurisé par email pour importer ou corriger un boxscore.</p></div></div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="flex h-10 flex-1 items-center gap-2 border border-stone-300 bg-white px-3"><Mail className="size-4 text-stone-400" /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="adresse@email.com" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
        <Button onClick={sendMagicLink} disabled={loading || !email.trim()} className="h-10 rounded-none bg-[#d71920] hover:bg-[#b71017]">Recevoir le lien</Button>
      </div>
      {message && <p className="mt-3 text-xs font-medium text-stone-600">{message}</p>}
    </div>
  );
}

function AccessNotice({ icon, title, copy, tone, action }: { icon: React.ReactNode; title: string; copy: string; tone: "bad" | "neutral"; action?: React.ReactNode }) {
  const classes = tone === "bad" ? "border-red-200 bg-red-50 text-red-950" : "border-stone-200 bg-stone-50 text-stone-950";
  return <div className={`flex flex-wrap items-center justify-between gap-3 border p-4 ${classes}`}><div className="flex items-start gap-3 [&_svg]:mt-0.5 [&_svg]:size-5"><span>{icon}</span><div><div className="font-bold">{title}</div><p className="mt-1 text-sm opacity-75">{copy}</p></div></div>{action}</div>;
}
