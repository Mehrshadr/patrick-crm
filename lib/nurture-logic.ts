import { addDays, setHours, setMinutes, setSeconds, isAfter, startOfDay } from "date-fns"

export function calculateNextNurture(leadCreatedAt: Date, currentStage: number): { nextStage: number, scheduleAt: Date } | null {
    // Lead Created Time (Local Time logic simulated)
    const created = new Date(leadCreatedAt)
    const hour = created.getHours()

    // Definition of "Day" and "Night" based on user requirement
    // Day: 8:00 AM - 11:59 PM (8 - 23)
    // Night: 12:00 AM - 7:59 AM (0 - 7)

    const isNight = hour >= 0 && hour < 8

    // Logic for Stage 2 (First Follow-up)
    if (currentStage === 1) { // Assuming Stage 1 is sent immediately upon creation
        if (isNight) {
            // Night Rule: Stage 2 at 12:00 PM (Noon) SAME DAY
            // Example: Created at 2 AM -> Stage 2 at 12 PM Today
            let target = setHours(setMinutes(setSeconds(created, 0), 0), 12)

            // Safety check: if for some reason we are already past 12pm (unlikely if isNight is true), move to tomorrow
            if (isAfter(new Date(), target)) {
                target = addDays(target, 1)
            }
            return { nextStage: 2, scheduleAt: target }
        } else {
            // Day Rule: Stage 2 at 2:00 PM (14:00) NEXT DAY
            // Example: Created at 9 AM -> Stage 2 at 2 PM Tomorrow
            let target = addDays(created, 1)
            target = setHours(setMinutes(setSeconds(target, 0), 0), 14)
            return { nextStage: 2, scheduleAt: target }
        }
    }

    // Logic for Stage 3 (Second Follow-up)
    if (currentStage === 2) {
        if (isNight) {
            // Night Rule: Stage 3 at 7:00 PM (19:00) NEXT DAY (relative to creation) -> Actually "Tomorrow" relative to Stage 2?
            // User said: "Stage 2 today 12pm, Stage 3 tomorrow 7pm".
            // So it is 1 day after creation date, at 19:00.

            let target = addDays(created, 1)
            target = setHours(setMinutes(setSeconds(target, 0), 0), 19)
            return { nextStage: 3, scheduleAt: target }
        } else {
            // Day Rule: Stage 3 at 7:00 PM (19:00) DAY AFTER NEXT
            // User said: "Stage 2 tomorrow 2pm, Stage 3 day after tomorrow 7pm".
            // So it is 2 days after creation.

            let target = addDays(created, 2)
            target = setHours(setMinutes(setSeconds(target, 0), 0), 19)
            return { nextStage: 3, scheduleAt: target }
        }
    }

    return null // No more stages
}
