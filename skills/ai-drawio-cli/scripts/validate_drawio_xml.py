#!/usr/bin/env python3

from __future__ import annotations

import argparse
import base64
import json
import math
import sys
import urllib.parse
import zlib
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from xml.etree import ElementTree as ET


@dataclass(frozen=True)
class Point:
    x: float
    y: float


@dataclass(frozen=True)
class Rect:
    x: float
    y: float
    width: float
    height: float

    @property
    def left(self) -> float:
        return self.x

    @property
    def right(self) -> float:
        return self.x + self.width

    @property
    def top(self) -> float:
        return self.y

    @property
    def bottom(self) -> float:
        return self.y + self.height

    @property
    def center(self) -> Point:
        return Point(self.x + self.width / 2.0, self.y + self.height / 2.0)


def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[-1]
    return tag


def _iter_local(root: ET.Element, name: str) -> Iterable[ET.Element]:
    for element in root.iter():
        if _local_name(element.tag) == name:
            yield element


def _b64_decode_maybe_urlencoded(text: str) -> bytes:
    raw = text.strip()
    if not raw:
        raise ValueError("Empty diagram payload.")

    # Some exports or transports may URL-encode the base64 string.
    # Only unquote when it looks URL-encoded; otherwise keep it as-is.
    if "%" in raw:
        raw = urllib.parse.unquote(raw)

    raw = "".join(raw.split())
    padding = (-len(raw)) % 4
    if padding:
        raw = raw + ("=" * padding)

    if "-" in raw or "_" in raw:
        return base64.urlsafe_b64decode(raw.encode("utf-8"))
    return base64.b64decode(raw.encode("utf-8"), validate=False)


def _inflate_drawio(data: bytes) -> str:
    # draw.io typically stores diagram payload as raw DEFLATE-compressed XML.
    # Some variants include zlib headers. Try a few common modes.
    last_error: Optional[Exception] = None
    for wbits in (-15, 15, 15 + 32):
        try:
            inflated = zlib.decompress(data, wbits=wbits)
            return inflated.decode("utf-8", errors="replace")
        except Exception as exc:  # noqa: BLE001
            last_error = exc
    raise ValueError(f"Unable to inflate diagram payload: {last_error}") from last_error


def _parse_mxgraphmodel_from_diagram(diagram: ET.Element) -> ET.Element:
    # Preferred: uncompressed mxGraphModel already present.
    for child in diagram:
        if _local_name(child.tag) == "mxGraphModel":
            return child

    # Fallback: diagram text contains encoded payload.
    text = (diagram.text or "").strip()
    if not text:
        raise ValueError("Diagram element has no mxGraphModel child and no text payload.")

    if text.lstrip().startswith("<"):
        root = ET.fromstring(text)
        if _local_name(root.tag) == "mxGraphModel":
            return root
        for element in _iter_local(root, "mxGraphModel"):
            return element
        raise ValueError("Inline XML payload does not contain mxGraphModel.")

    compressed = _b64_decode_maybe_urlencoded(text)
    inflated_xml = _inflate_drawio(compressed)
    root = ET.fromstring(inflated_xml)
    if _local_name(root.tag) == "mxGraphModel":
        return root
    for element in _iter_local(root, "mxGraphModel"):
        return element
    raise ValueError("Inflated payload does not contain mxGraphModel.")


@dataclass
class PageReport:
    page_index: int
    page_id: str
    page_name: str
    cells_total: int
    vertices: int
    edges: int
    errors: List[str]
    warnings: List[str]


@dataclass(frozen=True)
class ValidationOptions:
    check_overlap: bool = True
    check_arrow_direction: bool = True
    check_connector_through_shape: bool = True
    check_edge_crossings: bool = True
    max_vertices_for_pairwise: int = 1200
    max_edges_for_pairwise: int = 1500


def _cell_id(cell: ET.Element) -> Optional[str]:
    return cell.attrib.get("id")


def _is_vertex(cell: ET.Element) -> bool:
    return cell.attrib.get("vertex") == "1"


def _is_edge(cell: ET.Element) -> bool:
    return cell.attrib.get("edge") == "1"


def _find_geometry(cell: ET.Element) -> Optional[ET.Element]:
    for child in cell:
        if _local_name(child.tag) == "mxGeometry":
            return child
    return None


def _style_kv(style: str) -> Dict[str, str]:
    result: Dict[str, str] = {}
    for part in style.split(";"):
        part = part.strip()
        if not part:
            continue
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        result[key.strip()] = value.strip()
    return result


def _as_float(value: Optional[str]) -> Optional[float]:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _rects_overlap(a: Rect, b: Rect) -> bool:
    # Touching edges is OK; only positive-area overlap fails.
    overlap_x = min(a.right, b.right) - max(a.left, b.left)
    overlap_y = min(a.bottom, b.bottom) - max(a.top, b.top)
    return overlap_x > 0.0 and overlap_y > 0.0


def _point_in_rect(point: Point, rect: Rect) -> bool:
    return rect.left <= point.x <= rect.right and rect.top <= point.y <= rect.bottom


def _segment_intersects_rect(p1: Point, p2: Point, rect: Rect) -> bool:
    # Liang-Barsky clipping; returns True if segment intersects the rectangle.
    dx = p2.x - p1.x
    dy = p2.y - p1.y
    p = [-dx, dx, -dy, dy]
    q = [p1.x - rect.left, rect.right - p1.x, p1.y - rect.top, rect.bottom - p1.y]
    u1 = 0.0
    u2 = 1.0
    for pi, qi in zip(p, q, strict=True):
        if pi == 0.0:
            if qi < 0.0:
                return False
            continue
        t = qi / pi
        if pi < 0.0:
            if t > u2:
                return False
            u1 = max(u1, t)
        else:
            if t < u1:
                return False
            u2 = min(u2, t)
    return u1 <= u2


def _boundary_point(rect: Rect, toward: Point) -> Point:
    center = rect.center
    dx = toward.x - center.x
    dy = toward.y - center.y
    if dx == 0.0 and dy == 0.0:
        return center

    candidates: List[Tuple[float, Point]] = []
    if dx != 0.0:
        for x_side in (rect.left, rect.right):
            t = (x_side - center.x) / dx
            if t <= 0.0:
                continue
            y_at = center.y + t * dy
            if rect.top <= y_at <= rect.bottom:
                candidates.append((t, Point(x_side, y_at)))
    if dy != 0.0:
        for y_side in (rect.top, rect.bottom):
            t = (y_side - center.y) / dy
            if t <= 0.0:
                continue
            x_at = center.x + t * dx
            if rect.left <= x_at <= rect.right:
                candidates.append((t, Point(x_at, y_side)))

    if not candidates:
        return center
    candidates.sort(key=lambda item: item[0])
    return candidates[0][1]


def _distance(a: Point, b: Point) -> float:
    return math.hypot(a.x - b.x, a.y - b.y)


def _cross(ax: float, ay: float, bx: float, by: float) -> float:
    return ax * by - ay * bx


def _points_equal(a: Point, b: Point, eps: float = 1e-6) -> bool:
    return _distance(a, b) <= eps


def _point_on_segment(point: Point, start: Point, end: Point, eps: float = 1e-9) -> bool:
    if abs(_cross(end.x - start.x, end.y - start.y, point.x - start.x, point.y - start.y)) >= eps:
        return False
    return (
        min(start.x, end.x) - eps <= point.x <= max(start.x, end.x) + eps
        and min(start.y, end.y) - eps <= point.y <= max(start.y, end.y) + eps
    )


def _point_on_segment_interior(point: Point, start: Point, end: Point, eps: float = 1e-9) -> bool:
    return (
        _point_on_segment(point, start, end, eps)
        and not _points_equal(point, start, eps)
        and not _points_equal(point, end, eps)
    )


def _simplify_polyline(points: List[Point]) -> List[Point]:
    simplified: List[Point] = []
    for point in points:
        simplified.append(point)
        while len(simplified) >= 3:
            a = simplified[-3]
            b = simplified[-2]
            c = simplified[-1]
            if not _point_on_segment_interior(b, a, c):
                break
            simplified.pop(-2)
    return simplified


def _segment_intersection_point(
    p1: Point, p2: Point, q1: Point, q2: Point, eps: float = 1e-9
) -> Tuple[bool, Optional[Point], bool]:
    """
    Returns (intersects, point, colinear_overlap).
    If segments overlap colinearly, intersects=True, point=None, colinear_overlap=True.
    """

    r_x = p2.x - p1.x
    r_y = p2.y - p1.y
    s_x = q2.x - q1.x
    s_y = q2.y - q1.y
    denom = _cross(r_x, r_y, s_x, s_y)
    qmp_x = q1.x - p1.x
    qmp_y = q1.y - p1.y

    if abs(denom) < eps:
        # Parallel
        if abs(_cross(qmp_x, qmp_y, r_x, r_y)) >= eps:
            return False, None, False
        # Colinear: check 1D overlap on x or y axis.
        def proj(a: Point, b: Point) -> Tuple[float, float]:
            if abs(r_x) >= abs(r_y):
                return (a.x, b.x)
            return (a.y, b.y)

        p_a, p_b = proj(p1, p2)
        q_a, q_b = proj(q1, q2)
        p_min, p_max = (min(p_a, p_b), max(p_a, p_b))
        q_min, q_max = (min(q_a, q_b), max(q_a, q_b))
        if p_max < q_min - eps or q_max < p_min - eps:
            return False, None, False
        return True, None, True

    t = _cross(qmp_x, qmp_y, s_x, s_y) / denom
    u = _cross(qmp_x, qmp_y, r_x, r_y) / denom
    if -eps <= t <= 1.0 + eps and -eps <= u <= 1.0 + eps:
        point = Point(p1.x + t * r_x, p1.y + t * r_y)
        return True, point, False
    return False, None, False


def _validate_mxgraphmodel(
    model: ET.Element, options: ValidationOptions
) -> Tuple[int, int, int, List[str], List[str]]:
    errors: List[str] = []
    warnings: List[str] = []

    cells = list(_iter_local(model, "mxCell"))
    cells_total = len(cells)
    if cells_total == 0:
        errors.append("No mxCell elements found in mxGraphModel.")
        return cells_total, 0, 0, errors, warnings

    id_to_cell: Dict[str, ET.Element] = {}
    duplicate_ids: Dict[str, int] = {}
    parent_of: Dict[str, str] = {}

    vertices = 0
    edges = 0

    for cell in cells:
        cell_id = _cell_id(cell)
        if not cell_id:
            warnings.append("Found mxCell without id attribute.")
            continue
        if cell_id in id_to_cell:
            duplicate_ids[cell_id] = duplicate_ids.get(cell_id, 1) + 1
        else:
            id_to_cell[cell_id] = cell

        parent = cell.attrib.get("parent")
        if parent:
            parent_of[cell_id] = parent

        if _is_vertex(cell):
            vertices += 1
        if _is_edge(cell):
            edges += 1

    for cell_id, count in sorted(duplicate_ids.items()):
        errors.append(f"Duplicate mxCell id: {cell_id} (seen {count} times).")

    def is_ancestor(ancestor_id: str, child_id: str) -> bool:
        current = parent_of.get(child_id)
        guard = 0
        while current and guard < 2000:
            if current == ancestor_id:
                return True
            current = parent_of.get(current)
            guard += 1
        return False

    vertex_bbox_cache: Dict[str, Optional[Rect]] = {}

    def vertex_bbox(cell_id: str) -> Optional[Rect]:
        if cell_id in vertex_bbox_cache:
            return vertex_bbox_cache[cell_id]
        cell = id_to_cell.get(cell_id)
        if cell is None or not _is_vertex(cell):
            vertex_bbox_cache[cell_id] = None
            return None
        geometry = _find_geometry(cell)
        if geometry is None:
            vertex_bbox_cache[cell_id] = None
            return None
        width = _as_float(geometry.attrib.get("width"))
        height = _as_float(geometry.attrib.get("height"))
        if width is None or height is None:
            errors.append(
                f"Vertex mxCell {cell_id} geometry missing width/height; cannot run overlap/geometry checks reliably."
            )
            vertex_bbox_cache[cell_id] = None
            return None
        x = _as_float(geometry.attrib.get("x"))
        y = _as_float(geometry.attrib.get("y"))
        if x is None or y is None:
            errors.append(
                f"Vertex mxCell {cell_id} geometry missing x/y; cannot run overlap/geometry checks reliably."
            )
            x = x or 0.0
            y = y or 0.0
        parent_id = parent_of.get(cell_id)
        if parent_id and parent_id in id_to_cell and _is_vertex(id_to_cell[parent_id]):
            parent_rect = vertex_bbox(parent_id)
            if parent_rect is not None:
                x += parent_rect.x
                y += parent_rect.y
        rect = Rect(x=x, y=y, width=width, height=height)
        vertex_bbox_cache[cell_id] = rect
        return rect

    # Geometry sanity for vertices (excluding the implicit root cells 0/1 when present).
    for cell in cells:
        if not _is_vertex(cell):
            continue
        cell_id = _cell_id(cell) or ""
        if cell_id in ("0", "1"):
            continue
        geometry = _find_geometry(cell)
        if geometry is None:
            errors.append(f"Vertex mxCell {cell_id} is missing mxGeometry.")
            continue
        if geometry.attrib.get("width") is None or geometry.attrib.get("height") is None:
            warnings.append(f"Vertex mxCell {cell_id} geometry missing width/height.")

    # Connector endpoints: edges must have source + target pointing to existing vertices.
    for cell in cells:
        if not _is_edge(cell):
            continue
        edge_id = _cell_id(cell) or "<missing-id>"
        source = cell.attrib.get("source")
        target = cell.attrib.get("target")
        if not source or not target:
            errors.append(f"Edge mxCell {edge_id} is missing source or target.")
            continue
        if source not in id_to_cell:
            errors.append(f"Edge mxCell {edge_id} source references missing id: {source}.")
        if target not in id_to_cell:
            errors.append(f"Edge mxCell {edge_id} target references missing id: {target}.")
        if source in id_to_cell and not _is_vertex(id_to_cell[source]):
            warnings.append(
                f"Edge mxCell {edge_id} source references a non-vertex cell: {source}."
            )
        if target in id_to_cell and not _is_vertex(id_to_cell[target]):
            warnings.append(
                f"Edge mxCell {edge_id} target references a non-vertex cell: {target}."
            )

        if options.check_arrow_direction:
            style = cell.attrib.get("style", "")
            style_map = _style_kv(style)
            end_arrow = style_map.get("endArrow")
            start_arrow = style_map.get("startArrow")
            if not end_arrow or end_arrow.lower() == "none":
                hint = ""
                if start_arrow and start_arrow.lower() != "none":
                    hint = " (startArrow is set; arrow may be reversed)"
                errors.append(f"Edge mxCell {edge_id} is missing endArrow{hint}.")

    # Overlap checks for vertices (excluding ancestor/descendant containment).
    if options.check_overlap:
        if vertices > options.max_vertices_for_pairwise:
            errors.append(
                f"Skipping overlap checks: vertices={vertices} exceeds max_vertices_for_pairwise={options.max_vertices_for_pairwise}."
            )
        else:
            vertex_ids = [
                cid
                for cid, c in id_to_cell.items()
                if _is_vertex(c) and cid not in ("0", "1") and vertex_bbox(cid) is not None
            ]
            for i in range(len(vertex_ids)):
                a_id = vertex_ids[i]
                a_rect = vertex_bbox(a_id)
                if a_rect is None:
                    continue
                for j in range(i + 1, len(vertex_ids)):
                    b_id = vertex_ids[j]
                    if is_ancestor(a_id, b_id) or is_ancestor(b_id, a_id):
                        continue
                    b_rect = vertex_bbox(b_id)
                    if b_rect is None:
                        continue
                    if _rects_overlap(a_rect, b_rect):
                        errors.append(f"Vertex overlap detected between {a_id} and {b_id}.")

    def edge_polyline(edge_cell: ET.Element) -> Optional[Tuple[str, str, str, List[Point]]]:
        edge_id = _cell_id(edge_cell) or "<missing-id>"
        source_id = edge_cell.attrib.get("source")
        target_id = edge_cell.attrib.get("target")
        if not source_id or not target_id:
            return None
        source_rect = vertex_bbox(source_id)
        target_rect = vertex_bbox(target_id)
        if source_rect is None or target_rect is None:
            return None

        geometry = _find_geometry(edge_cell)
        points: List[Point] = []
        if geometry is not None:
            # Prefer explicit routing points under <Array as="points">.
            points_array: Optional[ET.Element] = None
            for child in geometry:
                if _local_name(child.tag) == "Array" and child.attrib.get("as") == "points":
                    points_array = child
                    break
            if points_array is not None:
                for element in points_array:
                    if _local_name(element.tag) != "mxPoint":
                        continue
                    x = _as_float(element.attrib.get("x"))
                    y = _as_float(element.attrib.get("y"))
                    if x is None or y is None:
                        continue
                    points.append(Point(x=x, y=y))

        # De-duplicate consecutive identical points.
        normalized_points: List[Point] = []
        for point in points:
            if not normalized_points or point != normalized_points[-1]:
                normalized_points.append(point)

        source_center = source_rect.center
        target_center = target_rect.center
        raw = [source_center] + normalized_points + [target_center]

        # Adjust endpoints onto the rectangle boundary to avoid "inside-shape" false positives.
        if len(raw) >= 2:
            raw[0] = _boundary_point(source_rect, raw[1])
            raw[-1] = _boundary_point(target_rect, raw[-2])

        # Drop degenerate adjacent segments.
        compact: List[Point] = []
        for point in raw:
            if not compact or _distance(point, compact[-1]) > 1e-6:
                compact.append(point)
        compact = _simplify_polyline(compact)
        if len(compact) < 2:
            return None
        return edge_id, source_id, target_id, compact

    polylines: List[Tuple[str, str, str, List[Point]]] = []
    for cell in cells:
        if not _is_edge(cell):
            continue
        poly = edge_polyline(cell)
        if poly is None:
            continue
        polylines.append(poly)

    reported_self_issues: set[str] = set()
    for edge_id, _source_id, _target_id, points in polylines:
        if edge_id in reported_self_issues:
            continue

        for idx in range(len(points) - 2):
            a = points[idx]
            b = points[idx + 1]
            c = points[idx + 2]
            if not _point_on_segment(b, a, c):
                continue
            if _point_on_segment_interior(b, a, c):
                continue
            errors.append(
                f"Self-overlap detected on edge {edge_id}: path backtracks along the same segment near waypoint {idx + 1}."
            )
            reported_self_issues.add(edge_id)
            break

        if edge_id in reported_self_issues:
            continue

        segments = list(zip(points, points[1:]))
        for i in range(len(segments)):
            p1, p2 = segments[i]
            for j in range(i + 2, len(segments)):
                q1, q2 = segments[j]
                intersects, point, colinear = _segment_intersection_point(p1, p2, q1, q2)
                if not intersects:
                    continue
                if colinear:
                    errors.append(
                        f"Self-overlap detected on edge {edge_id}: non-adjacent segments overlap."
                    )
                    reported_self_issues.add(edge_id)
                    break
                if point is None:
                    errors.append(
                        f"Self-intersection detected on edge {edge_id}."
                    )
                    reported_self_issues.add(edge_id)
                    break
                errors.append(
                    f"Self-intersection detected on edge {edge_id} at ({point.x:.2f},{point.y:.2f})."
                )
                reported_self_issues.add(edge_id)
                break
            if edge_id in reported_self_issues:
                break

    # Connector-through-shape checks.
    if options.check_connector_through_shape:
        if edges > options.max_edges_for_pairwise:
            errors.append(
                f"Skipping connector-through-shape checks: edges={edges} exceeds max_edges_for_pairwise={options.max_edges_for_pairwise}."
            )
        else:
            reported_through: set[tuple[str, str]] = set()
            vertex_ids = [
                cid
                for cid, c in id_to_cell.items()
                if _is_vertex(c) and cid not in ("0", "1") and vertex_bbox(cid) is not None
            ]
            for edge_id, source_id, target_id, points in polylines:
                segments = list(zip(points, points[1:]))
                for segment_start, segment_end in segments:
                    for vertex_id in vertex_ids:
                        if vertex_id in (source_id, target_id):
                            continue
                        # Ignore container ancestors of source/target to reduce false positives in swimlanes.
                        if is_ancestor(vertex_id, source_id) or is_ancestor(vertex_id, target_id):
                            continue
                        through_key = (edge_id, vertex_id)
                        if through_key in reported_through:
                            continue
                        rect = vertex_bbox(vertex_id)
                        if rect is None:
                            continue
                        if _segment_intersects_rect(segment_start, segment_end, rect):
                            # If the segment only touches at the rectangle boundary, this may still be a violation.
                            errors.append(
                                f"Connector-through-shape: edge {edge_id} intersects vertex {vertex_id}."
                            )
                            reported_through.add(through_key)
                            break

    # Edge crossing checks.
    if options.check_edge_crossings:
        if edges > options.max_edges_for_pairwise:
            errors.append(
                f"Skipping edge crossing checks: edges={edges} exceeds max_edges_for_pairwise={options.max_edges_for_pairwise}."
            )
        else:
            endpoint_eps = 2.0
            reported_pairs: set[tuple[str, str]] = set()
            for i in range(len(polylines)):
                e1_id, e1_source, e1_target, e1_points = polylines[i]
                e1_segments = list(zip(e1_points, e1_points[1:]))
                for j in range(i + 1, len(polylines)):
                    e2_id, e2_source, e2_target, e2_points = polylines[j]
                    pair_key = (e1_id, e2_id) if e1_id < e2_id else (e2_id, e1_id)
                    if pair_key in reported_pairs:
                        continue
                    # Shared endpoints are allowed.
                    if {e1_source, e1_target} & {e2_source, e2_target}:
                        continue
                    e2_segments = list(zip(e2_points, e2_points[1:]))
                    for p1, p2 in e1_segments:
                        for q1, q2 in e2_segments:
                            intersects, point, colinear = _segment_intersection_point(
                                p1, p2, q1, q2
                            )
                            if not intersects:
                                continue
                            if colinear:
                                errors.append(
                                    f"Shared-channel overlap detected between {e1_id} and {e2_id} (colinear segment overlap)."
                                )
                                reported_pairs.add(pair_key)
                                continue
                            if point is None:
                                errors.append(
                                    f"Edge crossing detected between {e1_id} and {e2_id}."
                                )
                                reported_pairs.add(pair_key)
                                continue
                            endpoints = [p1, p2, q1, q2]
                            if any(_distance(point, endpoint) <= endpoint_eps for endpoint in endpoints):
                                continue
                            errors.append(
                                f"Edge crossing detected between {e1_id} and {e2_id} at ({point.x:.2f},{point.y:.2f})."
                            )
                            reported_pairs.add(pair_key)
                            break
                        if pair_key in reported_pairs:
                            break
                    # Next edge pair

    return cells_total, vertices, edges, errors, warnings


def validate_mxfile(
    xml_path: Path, options: ValidationOptions
) -> Tuple[List[PageReport], List[str]]:
    document_errors: List[str] = []

    try:
        tree = ET.parse(xml_path)
    except ET.ParseError as exc:
        raise SystemExit(f"ERROR: XML is not well-formed: {exc}") from exc

    root = tree.getroot()
    root_name = _local_name(root.tag)
    if root_name != "mxfile":
        document_errors.append(f"Root element is '{root_name}', expected 'mxfile'.")

    diagrams = list(_iter_local(root, "diagram"))
    if not diagrams:
        document_errors.append("No <diagram> elements found under mxfile.")
        return [], document_errors

    reports: List[PageReport] = []
    for index, diagram in enumerate(diagrams, start=1):
        page_id = diagram.attrib.get("id", "")
        page_name = diagram.attrib.get("name", "")
        try:
            model = _parse_mxgraphmodel_from_diagram(diagram)
            cells_total, vertices, edges, errors, warnings = _validate_mxgraphmodel(
                model, options
            )
        except Exception as exc:  # noqa: BLE001
            cells_total, vertices, edges = 0, 0, 0
            errors = [f"Failed to parse/validate diagram payload: {exc}"]
            warnings = []

        reports.append(
            PageReport(
                page_index=index,
                page_id=page_id,
                page_name=page_name,
                cells_total=cells_total,
                vertices=vertices,
                edges=edges,
                errors=errors,
                warnings=warnings,
            )
        )

    return reports, document_errors


def main(argv: List[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Validate draw.io mxfile XML for connector/layout integrity."
    )
    parser.add_argument("xml_file", type=Path, help="Path to a draw.io mxfile XML.")
    parser.add_argument(
        "--json", action="store_true", help="Emit machine-readable JSON output."
    )
    parser.add_argument(
        "--fail-on-warn",
        action="store_true",
        help="Treat warnings as failures (non-zero exit).",
    )
    parser.add_argument(
        "--no-overlap",
        action="store_true",
        help="Disable vertex overlap checks.",
    )
    parser.add_argument(
        "--no-arrows",
        action="store_true",
        help="Disable arrow direction checks (endArrow at target).",
    )
    parser.add_argument(
        "--no-through-shape",
        action="store_true",
        help="Disable connector-through-shape checks.",
    )
    parser.add_argument(
        "--no-crossings",
        action="store_true",
        help="Disable edge crossing checks.",
    )
    args = parser.parse_args(argv)

    if not args.xml_file.exists():
        print(f"ERROR: File not found: {args.xml_file}", file=sys.stderr)
        return 2

    options = ValidationOptions(
        check_overlap=not args.no_overlap,
        check_arrow_direction=not args.no_arrows,
        check_connector_through_shape=not args.no_through_shape,
        check_edge_crossings=not args.no_crossings,
    )
    reports, document_errors = validate_mxfile(args.xml_file, options)

    any_errors = bool(document_errors) or any(r.errors for r in reports)
    any_warnings = any(r.warnings for r in reports)
    exit_code = 1 if any_errors or (args.fail_on_warn and any_warnings) else 0

    payload: Dict[str, Any] = {
        "file": str(args.xml_file),
        "ok": exit_code == 0,
        "document_errors": document_errors,
        "pages": [asdict(r) for r in reports],
    }

    if args.json:
        print(json.dumps(payload, indent=2, sort_keys=False))
    else:
        if document_errors:
            print("DOCUMENT ERRORS:", file=sys.stderr)
            for error in document_errors:
                print(f"- {error}", file=sys.stderr)
        for report in reports:
            label = report.page_name or report.page_id or f"page-{report.page_index}"
            status = "OK" if not report.errors else "FAIL"
            print(
                f"{status}: {label} (cells={report.cells_total}, vertices={report.vertices}, edges={report.edges})"
            )
            for error in report.errors:
                print(f"  ERROR: {error}")
            for warning in report.warnings:
                print(f"  WARN: {warning}")

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
