import {
  AssistantAlert,
  buildDetentionAlert,
  DetentionAlertInput,
  greetingFor,
  SNOOZE_HOURS,
  snoozeHoursForKey,
  sortAssistantAlerts,
  summaryLine,
} from "./assistant-alerts"

function alert(key: string, severity: AssistantAlert["severity"], shipmentId?: string): AssistantAlert {
  return {
    key,
    severity,
    kind: "eta",
    title: key,
    detail: "",
    actionLabel: "Go",
    href: "/",
    shipmentId,
  }
}

const detentionInput: DetentionAlertInput = {
  trackerId: "t1",
  containerNumber: "MSKU1234567",
  shipmentId: "s1",
  blNumber: "COSU1",
  deadlineDate: new Date(2026, 10, 6),
  level: "critical",
  daysRemaining: 4,
}

describe("sortAssistantAlerts", () => {
  it("orders critical, then warning, then info", () => {
    const sorted = sortAssistantAlerts([
      alert("i", "info"),
      alert("w", "warning"),
      alert("c", "critical"),
    ])
    expect(sorted.map((a) => a.key)).toEqual(["c", "w", "i"])
  })

  it("keeps the original order within a severity", () => {
    const sorted = sortAssistantAlerts([alert("w1", "warning"), alert("w2", "warning")])
    expect(sorted.map((a) => a.key)).toEqual(["w1", "w2"])
  })

  it("puts the current shipment's alerts first, even when less urgent", () => {
    const sorted = sortAssistantAlerts(
      [alert("other", "critical", "s2"), alert("here", "info", "s1")],
      "s1"
    )
    expect(sorted.map((a) => a.key)).toEqual(["here", "other"])
  })

  it("does not mutate its input", () => {
    const input = [alert("i", "info"), alert("c", "critical")]
    sortAssistantAlerts(input)
    expect(input.map((a) => a.key)).toEqual(["i", "c"])
  })
})

describe("buildDetentionAlert", () => {
  it("returns nothing while the container is comfortably inside free time", () => {
    expect(buildDetentionAlert({ ...detentionInput, level: "normal" }, "ops")).toBeNull()
  })

  it("treats critical and overdue as critical, warning as warning", () => {
    expect(buildDetentionAlert(detentionInput, "ops")?.severity).toBe("critical")
    expect(
      buildDetentionAlert({ ...detentionInput, level: "overdue", daysRemaining: -2 }, "ops")
        ?.severity
    ).toBe("critical")
    expect(
      buildDetentionAlert({ ...detentionInput, level: "warning", daysRemaining: 10 }, "ops")
        ?.severity
    ).toBe("warning")
  })

  it("puts the risk level in the key so escalation breaks through a snooze", () => {
    const warning = buildDetentionAlert({ ...detentionInput, level: "warning" }, "ops")
    const critical = buildDetentionAlert(detentionInput, "ops")
    expect(warning?.key).not.toBe(critical?.key)
  })

  it("sends ops to the detention page and transporters to the shipment", () => {
    expect(buildDetentionAlert(detentionInput, "ops")?.href).toBe("/shipments/detention")
    const forTransporter = buildDetentionAlert(detentionInput, "transporter")
    expect(forTransporter?.href).toBe("/shipments/s1")
    expect(forTransporter?.title).toBe("Return MSKU1234567 to the depot")
  })

  it("says how many days overdue a container is", () => {
    const overdue = buildDetentionAlert(
      { ...detentionInput, level: "overdue", daysRemaining: -3 },
      "ops"
    )
    expect(overdue?.detail).toContain("3 days overdue")
  })
})

describe("snoozeHoursForKey", () => {
  it("only allows a short snooze on critical detention alerts", () => {
    expect(snoozeHoursForKey("detention:t1:overdue")).toBe(4)
    expect(snoozeHoursForKey("detention:t1:critical")).toBe(4)
    expect(snoozeHoursForKey("detention:t1:warning")).toBe(24)
    expect(snoozeHoursForKey("stage2:s1")).toBe(24)
  })

  it("matches what buildDetentionAlert produces", () => {
    const built = buildDetentionAlert(detentionInput, "ops")!
    expect(snoozeHoursForKey(built.key)).toBe(SNOOZE_HOURS[built.severity])
  })
})

describe("summaryLine", () => {
  it("says the user is caught up when there's nothing", () => {
    expect(summaryLine([])).toBe("You're all caught up")
  })

  it("counts alerts and calls out urgent ones", () => {
    expect(summaryLine([alert("a", "critical"), alert("b", "info")])).toBe(
      "2 things need your attention · 1 urgent"
    )
    expect(summaryLine([alert("a", "info")])).toBe("1 thing needs your attention")
  })
})

describe("greetingFor", () => {
  it("matches the time of day", () => {
    expect(greetingFor(new Date(2026, 0, 1, 9))).toBe("Good morning")
    expect(greetingFor(new Date(2026, 0, 1, 14))).toBe("Good afternoon")
    expect(greetingFor(new Date(2026, 0, 1, 20))).toBe("Good evening")
  })
})
