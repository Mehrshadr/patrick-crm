import { addDays, setHours, setMinutes, setSeconds, isAfter, startOfDay, addHours } from "date-fns"

// Assuming User is in EST (UTC-5) based on feedback (9AM vs 2PM mismatch)
// We calculate "Day/Night" in Local Time.
// We schedule actions in UTC.
const SERVER_TO_LOCAL_OFFSET = -5

export function calculateNextNurture(leadCreatedAt: Date, currentStage: number): { nextStage: number, scheduleAt: Date } | null {
    // 1. Convert Creation Time to Local to determine Day/Night
    const createdUtc = new Date(leadCreatedAt)
    const createdLocal = addHours(createdUtc, SERVER_TO_LOCAL_OFFSET)
    const hour = createdLocal.getHours()

    // Definition of "Day" and "Night" (Local Time)
    // Day: 8:00 AM - 11:59 PM (8 - 23)
    // Night: 12:00 AM - 7:59 AM (0 - 7)

    const isNight = hour >= 0 && hour < 8

    // Helper: Set Local Time hour/min, then convert back to UTC
    const setTargetTime = (baseDate: Date, targetHour: number, daysToAdd: number) => {
        // Start from Local Base
        let target = addHours(baseDate, SERVER_TO_LOCAL_OFFSET) // to Local
        target = addDays(target, daysToAdd)
        target = setHours(setMinutes(setSeconds(target, 0), 0), targetHour)

        // Convert back to UTC (Server Time)
        return addHours(target, -SERVER_TO_LOCAL_OFFSET)
    }

    // Logic for Stage 2 (First Follow-up)
    if (currentStage === 1) {
        if (isNight) {
            // Night Rule: Stage 2 at 12:00 PM (Noon) SAME DAY
            let target = setTargetTime(leadCreatedAt, 12, 0)

            // If already past 12pm, move to tomorrow
            if (isAfter(new Date(), target)) {
                target = addDays(target, 1) // Simple addDays works broadly
            }
            return { nextStage: 2, scheduleAt: target }
        } else {
            // Day Rule: Stage 2 at 2:00 PM (14:00) NEXT DAY
            const target = setTargetTime(leadCreatedAt, 14, 1)
            return { nextStage: 2, scheduleAt: target }
        }
    }

    // Logic for Stage 3 (Second Follow-up)
    if (currentStage === 2) {
        if (isNight) {
            // Night Rule: Stage 3 at 7:00 PM (19:00) NEXT DAY (relative to creation)
            const target = setTargetTime(leadCreatedAt, 19, 1)
            return { nextStage: 3, scheduleAt: target }
        } else {
            // Day Rule: Stage 3 at 7:00 PM (19:00) DAY AFTER NEXT
            const target = setTargetTime(leadCreatedAt, 19, 2)
            return { nextStage: 3, scheduleAt: target }
        }
    }

    return null // No more stages
}
