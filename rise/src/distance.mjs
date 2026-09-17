const EARTH_RADIUS_MILES = 3958.7613;

function toRadians(value) {
  return value * Math.PI / 180;
}

function validCoordinate(point) {
  return point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
}

export function approximateStraightLineDistance(origin, destination, metadata = {}) {
  if (!validCoordinate(origin) || !validCoordinate(destination)) {
    return {
      state: "unknown",
      reason: "location_unavailable",
      method: "haversine",
      precision: "approximate_straight_line",
    };
  }
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const miles = EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return {
    state: "known",
    miles: Math.round(miles * 10) / 10,
    method: "haversine",
    precision: "approximate_straight_line",
    originBasis: metadata.originBasis ?? "unspecified_coordinate",
    destinationBasis: metadata.destinationBasis ?? "unspecified_coordinate",
    datasetVersion: metadata.datasetVersion ?? "not_stated",
    label: `Approximately ${Math.round(miles)} straight-line miles`,
  };
}
