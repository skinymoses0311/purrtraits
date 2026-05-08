// Bridges Google's CMP (TCF v2.2 via __tcfapi) into the GTM dataLayer so
// GA4 can report on consent UI impressions and user choices alongside the
// rest of our analytics. AdSense's bundled CMP is TCF-certified, so the
// __tcfapi global is the supported integration point — there is no
// dedicated "consent submitted" callback we can hook.
//
// We push two events:
//   cmp_ui_shown    — once per page when the consent dialog is displayed
//   cmp_user_action — when the user submits a choice (accept / reject / customize)

import { track } from "./analytics";

type TcfEventStatus = "tcloaded" | "cmpuishown" | "useractioncomplete";

type TcfData = {
  eventStatus?: TcfEventStatus;
  cmpStatus?: "loaded" | "loading" | "stub" | "error";
  tcString?: string;
  purpose?: { consents?: Record<string, boolean> };
  vendor?: { consents?: Record<string, boolean> };
  listenerId?: number;
};

type TcfApi = (
  command: "addEventListener" | "removeEventListener",
  version: number,
  callback: (data: TcfData | null, success: boolean) => void,
  parameter?: number,
) => void;

declare global {
  interface Window {
    __tcfapi?: TcfApi;
  }
}

function classifyAction(consents: Record<string, boolean> | undefined): "accept_all" | "reject_all" | "customize" {
  if (!consents) return "customize";
  const values = Object.values(consents);
  if (values.length === 0) return "customize";
  if (values.every((v) => v === true)) return "accept_all";
  if (values.every((v) => v === false)) return "reject_all";
  return "customize";
}

export function initCmpTracking(): void {
  if (typeof window === "undefined") return;

  let uiShownFired = false;
  let lastActionTcString: string | null = null;

  // The TCF stub may load before the real CMP — poll briefly until __tcfapi is ready.
  const start = Date.now();
  const poll = window.setInterval(() => {
    if (typeof window.__tcfapi === "function") {
      window.clearInterval(poll);
      attach();
    } else if (Date.now() - start > 15000) {
      // Give up after 15s — CMP failed to load or is blocked.
      window.clearInterval(poll);
    }
  }, 200);

  function attach(): void {
    try {
      window.__tcfapi!("addEventListener", 2, (tcData, success) => {
        if (!success || !tcData) return;

        if (tcData.eventStatus === "cmpuishown" && !uiShownFired) {
          uiShownFired = true;
          track("cmp_ui_shown", { cmp_status: tcData.cmpStatus });
          return;
        }

        if (tcData.eventStatus === "useractioncomplete") {
          // Dedupe: some CMPs re-fire useractioncomplete on settings reopens
          // even when the tcString is unchanged.
          if (tcData.tcString && tcData.tcString === lastActionTcString) return;
          lastActionTcString = tcData.tcString ?? null;

          const consents = tcData.purpose?.consents ?? {};
          const action = classifyAction(consents);

          track("cmp_user_action", {
            cmp_action: action,
            cmp_status: tcData.cmpStatus,
            // Per-purpose booleans — purposes 1-10 in TCF v2.2. Flattened so
            // each becomes its own GA4 event parameter (custom dimensions).
            cmp_purpose_1: !!consents["1"], // Store and/or access information on a device
            cmp_purpose_2: !!consents["2"], // Use limited data to select advertising
            cmp_purpose_3: !!consents["3"], // Create profiles for personalised advertising
            cmp_purpose_4: !!consents["4"], // Use profiles to select personalised advertising
            cmp_purpose_5: !!consents["5"], // Create profiles to personalise content
            cmp_purpose_6: !!consents["6"], // Use profiles to select personalised content
            cmp_purpose_7: !!consents["7"], // Measure advertising performance
            cmp_purpose_8: !!consents["8"], // Measure content performance
            cmp_purpose_9: !!consents["9"], // Understand audiences through statistics
            cmp_purpose_10: !!consents["10"], // Develop and improve services
            cmp_tc_string: tcData.tcString,
          });
        }
      });
    } catch {
      // Swallow — CMP tracking must never break the app.
    }
  }
}
