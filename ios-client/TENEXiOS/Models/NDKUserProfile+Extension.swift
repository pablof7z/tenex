import Foundation
import NDKSwift

extension NDKUserProfile: Codable {
    enum CodingKeys: String, CodingKey {
        case name
        case displayName = "display_name"
        case about
        case picture
        case banner
        case nip05
        case lud16
        case lud06
        case website
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        self.init(
            name: try container.decodeIfPresent(String.self, forKey: .name),
            displayName: try container.decodeIfPresent(String.self, forKey: .displayName),
            about: try container.decodeIfPresent(String.self, forKey: .about),
            picture: try container.decodeIfPresent(String.self, forKey: .picture),
            banner: try container.decodeIfPresent(String.self, forKey: .banner),
            nip05: try container.decodeIfPresent(String.self, forKey: .nip05),
            lud16: try container.decodeIfPresent(String.self, forKey: .lud16),
            lud06: try container.decodeIfPresent(String.self, forKey: .lud06),
            website: try container.decodeIfPresent(String.self, forKey: .website)
        )
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        
        try container.encodeIfPresent(name, forKey: .name)
        try container.encodeIfPresent(displayName, forKey: .displayName)
        try container.encodeIfPresent(about, forKey: .about)
        try container.encodeIfPresent(picture, forKey: .picture)
        try container.encodeIfPresent(banner, forKey: .banner)
        try container.encodeIfPresent(nip05, forKey: .nip05)
        try container.encodeIfPresent(lud16, forKey: .lud16)
        try container.encodeIfPresent(lud06, forKey: .lud06)
        try container.encodeIfPresent(website, forKey: .website)
    }
}