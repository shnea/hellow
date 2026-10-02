package kr.shnea.hellow.platform;

import java.util.List;

public record PlatformContext(
        String projectId,
        String environmentId,
        String kind,
        String issuer,
        List<String> scopes,
        boolean verified,
        String statusMessage
) {
    public static PlatformContext unconfigured(String message) {
        return new PlatformContext(null, null, "UNCONFIGURED", null, List.of(), false, message);
    }
}
