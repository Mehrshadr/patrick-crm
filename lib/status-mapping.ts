// Status is now the STAGE (Column)
export type PipelineStage =
    | "New"
    | "Meeting1"
    | "Audit"
    | "Meeting2"
    | "Meeting3"
    | "FollowUp"
    | "Won"
    | "Lost"
    | "Ghosted"

export const STAGE_CONFIG: Record<PipelineStage, {
    label: string,
    color: string,
    subStatuses: string[]
}> = {
    "New": {
        label: "Fresh In (Welcome)",
        color: "bg-blue-50 border-blue-200 text-blue-700",
        subStatuses: ["Welcome Sent", "Replied", "Not Interested", "Other"]
    },
    "Meeting1": {
        label: "Data Gathering",
        color: "bg-indigo-50 border-indigo-200 text-indigo-700",
        subStatuses: ["Scheduled", "Rescheduled", "No Show", "Done & Data Received", "Ghosted", "Other"]
    },
    "Audit": {
        label: "Audit Lab",
        color: "bg-yellow-50 border-yellow-200 text-yellow-700",
        subStatuses: ["Analyzing", "Ready", "Other"]
    },
    "Meeting2": {
        label: "Audit Reveal",
        color: "bg-purple-50 border-purple-200 text-purple-700",
        subStatuses: ["Scheduled", "Rescheduled", "No Show", "Audit Presented", "Ghosted", "Other"]
    },
    "Meeting3": {
        label: "Proposal Session",
        color: "bg-orange-50 border-orange-200 text-orange-700",
        subStatuses: ["Scheduled", "Rescheduled", "No Show", "Proposal Sent", "Thinking/Reviewing", "Negotiating", "Ghosted", "Other"]
    },
    "FollowUp": {
        label: "Follow Up",
        color: "bg-teal-50 border-teal-200 text-teal-700",
        subStatuses: ["To Call", "To Email", "To Meet", "Waiting Response", "Other"]
    },
    "Won": {
        label: "Won",
        color: "bg-green-50 border-green-200 text-green-700",
        subStatuses: ["Deal Won", "Onboarding"]
    },
    "Lost": {
        label: "Lost",
        color: "bg-red-50 border-red-200 text-red-700",
        subStatuses: ["Not Interested", "Not Qualified", "Too Expensive", "Other"]
    },
    "Ghosted": {
        label: "Ghosted",
        color: "bg-slate-100 border-slate-300 text-slate-600",
        subStatuses: ["Long Term Ghosted", "Ready for Nurture", "To Follow Up", "Other"]
    }
}

export function getStageForStatus(status: string): PipelineStage {
    // Legacy support: if status matches a new key, return it.
    if (status in STAGE_CONFIG) return status as PipelineStage;

    // Fallback for old data or if logic needs it (though we plan to migrate)
    if (status === "Meeting 1") return "Meeting1";
    if (status === "Meeting 2") return "Meeting2";
    if (status === "Meeting 3") return "Meeting3";
    if (status.includes("Discovery")) return "Meeting1";
    if (status.includes("Reveal")) return "Meeting2";
    if (status.includes("Closing") || status.includes("Proposal")) return "Meeting3";
    if (status.includes("Won")) return "Won";
    if (status.includes("Lost")) return "Lost";
    if (status.includes("Audit")) return "Audit";

    return "New";
}

export function getFriendlyStatusLabel(status: string, subStatus?: string | null): string {
    if (subStatus) return subStatus;
    // If no substatus, maybe return the stage label?
    const stage = getStageForStatus(status);
    return STAGE_CONFIG[stage]?.label || status;
}
