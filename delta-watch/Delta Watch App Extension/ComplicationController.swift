import ClockKit
import SwiftUI

class ComplicationController: NSObject, CLKComplicationDataSource {

    // MARK: - Complication Configuration

    func getComplicationDescriptors(handler: @escaping ([CLKComplicationDescriptor]) -> Void) {
        let descriptors = [
            CLKComplicationDescriptor(
                identifier: "delta_wellness",
                displayName: "Delta Wellness",
                supportedFamilies: [
                    .circularSmall,
                    .graphicCircular,
                    .graphicCorner,
                    .graphicRectangular,
                    .modularSmall,
                    .utilitarianSmall,
                    .utilitarianSmallFlat
                ]
            ),
            CLKComplicationDescriptor(
                identifier: "delta_workout",
                displayName: "Delta Workout",
                supportedFamilies: [
                    .graphicRectangular,
                    .modularLarge
                ]
            )
        ]
        handler(descriptors)
    }

    // MARK: - Timeline Configuration

    func getPrivacyBehavior(for complication: CLKComplication, withHandler handler: @escaping (CLKComplicationPrivacyBehavior) -> Void) {
        handler(.showOnLockScreen)
    }

    // MARK: - Timeline Population

    func getCurrentTimelineEntry(for complication: CLKComplication, withHandler handler: @escaping (CLKComplicationTimelineEntry?) -> Void) {
        let complicationData = CacheManager.shared.cache.complicationData ?? .empty

        if let template = makeTemplate(for: complication.family, data: complicationData) {
            let entry = CLKComplicationTimelineEntry(date: Date(), complicationTemplate: template)
            handler(entry)
        } else {
            handler(nil)
        }
    }

    // MARK: - Placeholder

    func getLocalizableSampleTemplate(for complication: CLKComplication, withHandler handler: @escaping (CLKComplicationTemplate?) -> Void) {
        let sampleData = ComplicationData(
            wellnessScore: 78,
            nextWorkoutName: "Upper Body",
            nextWorkoutTime: Date().addingTimeInterval(3600),
            streakDays: 7,
            cycleDay: nil
        )
        handler(makeTemplate(for: complication.family, data: sampleData))
    }

    // MARK: - Template Creation

    private func makeTemplate(for family: CLKComplicationFamily, data: ComplicationData) -> CLKComplicationTemplate? {
        switch family {
        case .circularSmall:
            return makeCircularSmallTemplate(data: data)
        case .graphicCircular:
            return makeGraphicCircularTemplate(data: data)
        case .graphicCorner:
            return makeGraphicCornerTemplate(data: data)
        case .graphicRectangular:
            return makeGraphicRectangularTemplate(data: data)
        case .modularSmall:
            return makeModularSmallTemplate(data: data)
        case .modularLarge:
            return makeModularLargeTemplate(data: data)
        case .utilitarianSmall, .utilitarianSmallFlat:
            return makeUtilitarianSmallTemplate(data: data)
        default:
            return nil
        }
    }

    // MARK: - Circular Small

    private func makeCircularSmallTemplate(data: ComplicationData) -> CLKComplicationTemplate {
        let gaugeProvider = CLKSimpleGaugeProvider(
            style: .ring,
            gaugeColor: wellnessColor(for: data.wellnessScore ?? 0),
            fillFraction: Float(data.wellnessScore ?? 0) / 100.0
        )
        let textProvider = CLKSimpleTextProvider(text: "\(data.wellnessScore ?? 0)")

        return CLKComplicationTemplateCircularSmallRingText(
            textProvider: textProvider,
            fillFraction: Float(data.wellnessScore ?? 0) / 100.0,
            ringStyle: .closed
        )
    }

    // MARK: - Graphic Circular

    private func makeGraphicCircularTemplate(data: ComplicationData) -> CLKComplicationTemplate {
        let gaugeProvider = CLKSimpleGaugeProvider(
            style: .fill,
            gaugeColor: wellnessColor(for: data.wellnessScore ?? 0),
            fillFraction: Float(data.wellnessScore ?? 0) / 100.0
        )

        return CLKComplicationTemplateGraphicCircularClosedGaugeText(
            gaugeProvider: gaugeProvider,
            centerTextProvider: CLKSimpleTextProvider(text: "\(data.wellnessScore ?? 0)")
        )
    }

    // MARK: - Graphic Corner

    private func makeGraphicCornerTemplate(data: ComplicationData) -> CLKComplicationTemplate {
        let gaugeProvider = CLKSimpleGaugeProvider(
            style: .fill,
            gaugeColor: wellnessColor(for: data.wellnessScore ?? 0),
            fillFraction: Float(data.wellnessScore ?? 0) / 100.0
        )

        let outerTextProvider = CLKSimpleTextProvider(text: "Delta")

        return CLKComplicationTemplateGraphicCornerGaugeText(
            gaugeProvider: gaugeProvider,
            outerTextProvider: outerTextProvider
        )
    }

    // MARK: - Graphic Rectangular

    private func makeGraphicRectangularTemplate(data: ComplicationData) -> CLKComplicationTemplate {
        let headerTextProvider = CLKSimpleTextProvider(text: "DELTA")

        var body1Text = "No workout scheduled"
        if let workoutName = data.nextWorkoutName {
            body1Text = workoutName
        }
        let body1Provider = CLKSimpleTextProvider(text: body1Text)

        var body2Text = ""
        if let wellnessScore = data.wellnessScore {
            body2Text = "Wellness: \(wellnessScore)%"
            if data.streakDays > 0 {
                body2Text += " • \(data.streakDays) day streak"
            }
        }
        let body2Provider = CLKSimpleTextProvider(text: body2Text)

        return CLKComplicationTemplateGraphicRectangularStandardBody(
            headerTextProvider: headerTextProvider,
            body1TextProvider: body1Provider,
            body2TextProvider: body2Provider
        )
    }

    // MARK: - Modular Small

    private func makeModularSmallTemplate(data: ComplicationData) -> CLKComplicationTemplate {
        return CLKComplicationTemplateModularSmallRingText(
            textProvider: CLKSimpleTextProvider(text: "\(data.wellnessScore ?? 0)"),
            fillFraction: Float(data.wellnessScore ?? 0) / 100.0,
            ringStyle: .closed
        )
    }

    // MARK: - Modular Large

    private func makeModularLargeTemplate(data: ComplicationData) -> CLKComplicationTemplate {
        let headerProvider = CLKSimpleTextProvider(text: "DELTA")

        var body1 = "No workout today"
        if let workoutName = data.nextWorkoutName {
            body1 = workoutName
        }

        var body2 = "Open app to get started"
        if let wellnessScore = data.wellnessScore {
            body2 = "Wellness: \(wellnessScore)%"
        }

        return CLKComplicationTemplateModularLargeStandardBody(
            headerTextProvider: headerProvider,
            body1TextProvider: CLKSimpleTextProvider(text: body1),
            body2TextProvider: CLKSimpleTextProvider(text: body2)
        )
    }

    // MARK: - Utilitarian Small

    private func makeUtilitarianSmallTemplate(data: ComplicationData) -> CLKComplicationTemplate {
        let textProvider: CLKTextProvider

        if let wellnessScore = data.wellnessScore {
            textProvider = CLKSimpleTextProvider(text: "\(wellnessScore)%")
        } else {
            textProvider = CLKSimpleTextProvider(text: "Delta")
        }

        return CLKComplicationTemplateUtilitarianSmallFlat(
            textProvider: textProvider
        )
    }

    // MARK: - Helpers

    private func wellnessColor(for score: Int) -> UIColor {
        switch score {
        case 80...100: return .green
        case 60..<80: return .yellow
        case 40..<60: return .orange
        default: return .red
        }
    }
}

// MARK: - Complication Update Helper

extension ComplicationController {
    static func reloadComplications() {
        let server = CLKComplicationServer.sharedInstance()
        for complication in server.activeComplications ?? [] {
            server.reloadTimeline(for: complication)
        }
    }
}
