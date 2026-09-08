import { parseShipmentDocument } from "./bl-parser"

describe("parseShipmentDocument", () => {
  it("returns all-undefined fields and no containers for empty/unrecognizable text", () => {
    const result = parseShipmentDocument("just some random unrelated text")
    expect(result.blNumber).toBeUndefined()
    expect(result.blType).toBeUndefined()
    expect(result.shippingLine).toBeUndefined()
    expect(result.containers).toEqual([])
  })

  it("extracts the BL number after a 'B/L NO' style label", () => {
    const result = parseShipmentDocument("BL NUMBER: MEDUXW419436")
    expect(result.blNumber).toBe("MEDUXW419436")
  })

  it("extracts the booking reference as a letters+digits code, ignoring anything riding along on the same line", () => {
    const result = parseShipmentDocument("BOOKING NO: EBKG17466733 SOME OTHER COLUMN TEXT")
    expect(result.bookingRef).toBe("EBKG17466733")
  })

  describe("blType detection", () => {
    it("detects a Sea Waybill", () => {
      expect(parseShipmentDocument("THIS IS A SEA WAYBILL").blType).toBe("SEA_WAYBILL")
    })

    it("detects an (original) Bill of Lading", () => {
      expect(parseShipmentDocument("NEGOTIABLE BILL OF LADING").blType).toBe("ORIGINAL")
    })

    it("prefers Sea Waybill over Bill of Lading when both phrases appear", () => {
      // A waybill's own boilerplate often still contains the phrase
      // "bill of lading" elsewhere on the form -- the document's own title
      // must win.
      expect(
        parseShipmentDocument("SEA WAYBILL\nNot a bill of lading in the legal sense").blType
      ).toBe("SEA_WAYBILL")
    })

    it("returns undefined when neither phrase appears", () => {
      expect(parseShipmentDocument("SOME OTHER SHIPPING DOCUMENT").blType).toBeUndefined()
    })
  })

  describe("shippingLine detection", () => {
    it("recognizes a full carrier name", () => {
      expect(parseShipmentDocument("MEDITERRANEAN SHIPPING COMPANY S.A.").shippingLine).toBe(
        "MSC"
      )
    })

    it("recognizes a short acronym only as a whole word", () => {
      expect(parseShipmentDocument("CARRIER: MSC MEDITERRANEAN").shippingLine).toBe("MSC")
    })

    it("does not misfire on unrelated text containing carrier-like substrings", () => {
      // No carrier name/alias present at all.
      expect(parseShipmentDocument("ORIGINAL BILL OF LADING").shippingLine).toBeUndefined()
    })

    it("recognizes Hapag-Lloyd with or without the hyphen", () => {
      expect(parseShipmentDocument("HAPAG LLOYD AG").shippingLine).toBe("Hapag-Lloyd")
      expect(parseShipmentDocument("HAPAG-LLOYD AG").shippingLine).toBe("Hapag-Lloyd")
    })
  })

  describe("port and country fields", () => {
    it("extracts the origin port and derives its country", () => {
      const result = parseShipmentDocument("PORT OF LOADING: MUNDRA, INDIA")
      expect(result.originPort).toBe("MUNDRA, INDIA")
      expect(result.originCountry).toBe("INDIA")
    })

    it("matches the discharge port against the known Rwanda-corridor ports", () => {
      expect(parseShipmentDocument("PORT OF DISCHARGE: MOMBASA, KENYA").dischargePort).toBe(
        "MOMBASA"
      )
      expect(
        parseShipmentDocument("PORT OF DISCHARGE: DAR ES SALAAM, TANZANIA").dischargePort
      ).toBe("DAR_ES_SALAAM")
    })

    it("leaves dischargePort undefined for a port outside the known set", () => {
      expect(
        parseShipmentDocument("PORT OF DISCHARGE: ROTTERDAM, NETHERLANDS").dischargePort
      ).toBeUndefined()
    })

    // Documented LABEL_BLEED behavior: OCR frequently flattens a
    // neighboring box's heading onto the same line as this field's label,
    // so the same-line remainder must be discarded in favor of the next
    // real line instead of being taken at face value.
    it("skips past a bled-in neighboring label to the real value on the next line", () => {
      const result = parseShipmentDocument(
        "PORT OF LOADING: PORT OF DISCHARGE\nMUNDRA, INDIA"
      )
      expect(result.originPort).toBe("MUNDRA, INDIA")
    })
  })

  describe("vessel and voyage", () => {
    it("splits a combined 'Vessel / Voyage' value into name and code", () => {
      const result = parseShipmentDocument("VESSEL / VOYAGE NO: MSC OSCAR / MA622R")
      expect(result.vesselName).toBe("MSC OSCAR")
      expect(result.voyageNumber).toBe("MA622R")
    })

    it("falls back to a standalone Voyage label when there's no combined value", () => {
      const result = parseShipmentDocument("VESSEL: EVER GIVEN\nVOYAGE NO: 0421E")
      expect(result.vesselName).toBe("EVER GIVEN")
      expect(result.voyageNumber).toBe("0421E")
    })
  })

  describe("shipper / consignee / notify party blocks", () => {
    it("collects the multi-line block after each label until the next label", () => {
      const result = parseShipmentDocument(
        [
          "SHIPPER",
          "ABC EXPORTS PVT LTD",
          "123 INDUSTRIAL AREA",
          "MUNDRA GUJARAT INDIA",
          "CONSIGNEE",
          "XYZ IMPORTS LTD",
          "KIGALI RWANDA",
          "NOTIFY PARTIES",
          "TOTAL LOGISTICS RWANDA LTD",
        ].join("\n")
      )
      expect(result.shipperName).toBe(
        "ABC EXPORTS PVT LTD, 123 INDUSTRIAL AREA, MUNDRA GUJARAT INDIA"
      )
      expect(result.consigneeName).toBe("XYZ IMPORTS LTD, KIGALI RWANDA")
      expect(result.notifyParty).toBe("TOTAL LOGISTICS RWANDA LTD")
    })
  })

  describe("container extraction", () => {
    it("parses container number, type, seal, tare/gross weight, and inventory reference from one card", () => {
      const result = parseShipmentDocument(
        [
          "MSCU1234567 500 CARTON(S) FOOTWEAR 12345.678 KGS",
          "40' HIGH CUBE",
          "SEAL NUMBER: SN12345",
          "TARE WEIGHT: 3800.00",
        ].join("\n")
      )
      expect(result.containers).toHaveLength(1)
      const [container] = result.containers
      expect(container.containerNumber).toBe("MSCU1234567")
      expect(container.containerType).toBe("40HC")
      expect(container.sealNumber).toBe("SN12345")
      expect(container.tareWeightKg).toBe("3800.00")
      expect(container.grossWeightKg).toBe("12345.678")
      expect(container.inventoryReference).toBe("500 CARTON(S) FOOTWEAR")
      expect(container.itemQuantity).toBe("500")
    })

    // Regression: the size lookback window can contain a nearby weight
    // fragment (here "...45.678" from the gross weight) ahead of the real
    // size -- the one immediately before the type word must win, not
    // whichever one appears first in the window.
    it("does not mistake a nearby weight digit for the container size", () => {
      const result = parseShipmentDocument(
        "MSCU1234567 CARGO 12345.678 KGS\n40' HIGH CUBE"
      )
      expect(result.containers[0].containerType).toBe("40HC")
    })

    it("recognizes a short container type code directly (e.g. 40HC, 20GP)", () => {
      const result = parseShipmentDocument("TCLU7654321 20GP SOME CARGO 900.00 KGS")
      expect(result.containers[0].containerType).toBe("20GP")
    })

    it("parses multiple containers without one card's details bleeding into the next", () => {
      const result = parseShipmentDocument(
        [
          "MSCU1234567 CARGO A 1000.00 KGS",
          "SEAL NUMBER: SEAL-AAA",
          "TCLU7654321 CARGO B 2000.00 KGS",
          "SEAL NUMBER: SEAL-BBB",
        ].join("\n")
      )
      expect(result.containers).toHaveLength(2)
      expect(result.containers[0]).toMatchObject({
        containerNumber: "MSCU1234567",
        sealNumber: "SEAL-AAA",
      })
      expect(result.containers[1]).toMatchObject({
        containerNumber: "TCLU7654321",
        sealNumber: "SEAL-BBB",
      })
    })

    it("de-duplicates the same container number if it's printed more than once", () => {
      const result = parseShipmentDocument(
        "MSCU1234567 CARGO 1000.00 KGS\n...\nMSCU1234567 repeated on a summary line"
      )
      expect(result.containers).toHaveLength(1)
    })

    it("returns no containers when nothing matches the container-number shape", () => {
      expect(parseShipmentDocument("no container numbers anywhere here").containers).toEqual([])
    })
  })
})
