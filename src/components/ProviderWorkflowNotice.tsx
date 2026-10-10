import { Info } from "lucide-react";
import { MIMO_WORKFLOW_NOTICE } from "../utils/providerSupport";
export function ProviderWorkflowNotice({ supported }: { supported: boolean }) {
  return supported ? null : <div className="provider-workflow-notice" role="note"><Info size={16} aria-hidden="true" /><span>{MIMO_WORKFLOW_NOTICE}</span></div>;
}
