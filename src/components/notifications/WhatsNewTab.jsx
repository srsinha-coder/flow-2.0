// Flow — WhatsNewTab
// Renders the product timeline (launches, shipped features, announcements).
import React from "react";
import TimelineView from "./TimelineView";

export default function WhatsNewTab({ whatsNew = [], goProject }) {
  return <TimelineView items={whatsNew} goProject={goProject} />;
}
