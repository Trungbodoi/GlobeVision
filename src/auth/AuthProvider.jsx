import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { AuthContext } from "./AuthContext";

function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [sessionReady, setSessionReady] = useState(!supabase);
  const [profileState, setProfileState] = useState(null);
  const [profileRequest, setProfileRequest] = useState(0);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setSessionReady(true);

      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;
  const profileKey = userId ? `${userId}:${profileRequest}` : null;

  useEffect(() => {
    if (!profileKey) return;

    let cancelled = false;

    supabase
      .from("profiles")
      .select("id, display_name, role")
      .eq("id", profileKey.split(":")[0])
      .single()
      .then(({ data, error }) => {
        if (!cancelled) setProfileState({ key: profileKey, profile: data, error });
      });

    return () => {
      cancelled = true;
    };
  }, [profileKey]);

  const currentProfile = profileState?.key === profileKey ? profileState : null;

  const reloadProfile = useCallback(() => setProfileRequest((count) => count + 1), []);

  const chooseRole = useCallback(
    async (role) => {
      const { data, error } = await supabase.rpc("choose_role", { new_role: role });

      if (error) throw error;

      setProfileState({ key: profileKey, profile: data, error: null });
    },
    [profileKey]
  );

  const value = useMemo(
    () => ({
      enabled: Boolean(supabase),
      loading: !sessionReady || (Boolean(profileKey) && !currentProfile),
      user: session?.user ?? null,
      profile: currentProfile?.profile ?? null,
      profileError: currentProfile?.error ?? null,
      recovering,
      finishRecovery: () => setRecovering(false),
      reloadProfile,
      chooseRole,
    }),
    [sessionReady, profileKey, currentProfile, session, recovering, reloadProfile, chooseRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
