import * as React from "react";
import { IResource } from "../utils/types";
import { getInitials } from "../utils/helpers";

interface IResourceChipProps {
  resource: IResource;
  onRemove?: (id: string) => void;
  small?: boolean;
}

/**
 * Displays a colored chip with avatar initials and the person's first name.
 * Shows a remove button (×) when onRemove is provided.
 */
export const ResourceChip: React.FC<IResourceChipProps> = ({ resource, onRemove, small }) => {
  const initials = getInitials(resource.name);
  const firstName = resource.name.split(" ")[0];
  const size = small ? 16 : 20;

  return (
    <span
      className="resource-chip"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: small ? 3 : 5,
        background: resource.color + "18",
        border: `1px solid ${resource.color}40`,
        borderRadius: 20,
        padding: small ? "1px 7px 1px 4px" : "2px 10px 2px 6px",
        fontSize: small ? 10.5 : 12,
        color: resource.color,
        fontWeight: 600,
        whiteSpace: "nowrap",
        lineHeight: 1.5,
        transition: "all 0.15s ease",
      }}
    >
      <span
        className="resource-chip__avatar"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: resource.color,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: small ? 8 : 9,
          fontWeight: 700,
          letterSpacing: 0.3,
          flexShrink: 0,
        }}
      >
        {initials}
      </span>
      {firstName}
      {onRemove && (
        <span
          className="resource-chip__remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(resource.id);
          }}
          style={{
            cursor: "pointer",
            marginLeft: 2,
            opacity: 0.5,
            fontSize: small ? 11 : 13,
            lineHeight: 1,
            transition: "opacity 0.1s",
          }}
          onMouseEnter={(e) => ((e.target as HTMLElement).style.opacity = "1")}
          onMouseLeave={(e) => ((e.target as HTMLElement).style.opacity = "0.5")}
          title={`Remove ${resource.name}`}
        >
          ×
        </span>
      )}
    </span>
  );
};
