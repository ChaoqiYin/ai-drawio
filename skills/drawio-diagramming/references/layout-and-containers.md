# Draw.io Layout And Containers

## Contents

- Edge routing
- Spacing and ports
- Waypoints
- Containers and groups
- Container examples

## Edge routing

Every edge `mxCell` must contain a nested `mxGeometry` child with `relative="1"` and `as="geometry"`, even when the edge has no explicit waypoints.

Use this form:

```xml
<mxCell id="e1" edge="1" parent="1" source="a" target="b" style="edgeStyle=orthogonalEdgeStyle;">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

Do not use self-closing edge cells for real connectors. They are unreliable and may render incorrectly.

Draw.io does not provide collision-free routing automatically. Plan the layout before drawing many edges.

## Spacing and ports

- Use `edgeStyle=orthogonalEdgeStyle` for most right-angle connectors.
- Space nodes generously. A good default is about `200px` horizontal and `120px` vertical.
- Keep at least `60px` between nearby nodes even in compact layouts.
- Use `exitX` and `exitY` plus `entryX` and `entryY` with values from `0` to `1` to control which side of each node a connector uses.
- Spread multiple connectors across different sides of a node to avoid overlap.
- Leave room for arrowheads. Keep at least `20px` of straight segment before the target and after the source.
- When automatic orthogonal routing places bends too close to shapes, either increase spacing or add explicit waypoints.
- Use `rounded=1` on edges for softer bends when the diagram style supports it.
- Use `jettySize=auto` to improve connector spacing around ports.
- Align nodes to a grid, usually multiples of `10`.

## Waypoints

Add explicit waypoints when automatic routing would overlap other connectors or pass too close to shapes.

```xml
<mxCell id="e1" style="edgeStyle=orthogonalEdgeStyle;" edge="1" parent="1" source="a" target="b">
  <mxGeometry relative="1" as="geometry">
    <Array as="points">
      <mxPoint x="300" y="150"/>
      <mxPoint x="300" y="250"/>
    </Array>
  </mxGeometry>
</mxCell>
```

Prefer a small number of deliberate bends over many short segments.

## Containers and groups

For architecture diagrams and other nested layouts, use real draw.io containment. Do not fake containment by placing shapes on top of a larger shape while leaving all children on the root layer.

Containment works by setting `parent="containerId"` on child cells. Child geometry is relative to the container.

### Container types

| Type | Style | Use |
| --- | --- | --- |
| Group | `group;` | Invisible container when no visible border or container connection is needed |
| Swimlane | `swimlane;startSize=30;` | Titled container with a header or when the container itself has connections |
| Custom container | Add `container=1;pointerEvents=0;` to a shape | Container behavior on a non-swimlane shape |

### Rules

- Add `pointerEvents=0;` to containers that should not capture child rewiring or child connections.
- Omit `pointerEvents=0` only when the container itself must be connectable. A swimlane usually fits this case.
- Set `parent="containerId"` on every child.
- Use geometry relative to the container, not absolute page coordinates.

## Container examples

Swimlane container:

```xml
<mxCell id="svc1" value="User Service" style="swimlane;startSize=30;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
  <mxGeometry x="100" y="100" width="300" height="200" as="geometry"/>
</mxCell>
<mxCell id="api1" value="REST API" style="rounded=1;whiteSpace=wrap;" vertex="1" parent="svc1">
  <mxGeometry x="20" y="40" width="120" height="60" as="geometry"/>
</mxCell>
<mxCell id="db1" value="Database" style="shape=cylinder3;whiteSpace=wrap;" vertex="1" parent="svc1">
  <mxGeometry x="160" y="40" width="120" height="60" as="geometry"/>
</mxCell>
```

Invisible group:

```xml
<mxCell id="grp1" value="" style="group;" vertex="1" parent="1">
  <mxGeometry x="100" y="100" width="300" height="200" as="geometry"/>
</mxCell>
<mxCell id="c1" value="Component A" style="rounded=1;whiteSpace=wrap;" vertex="1" parent="grp1">
  <mxGeometry x="10" y="10" width="120" height="60" as="geometry"/>
</mxCell>
```
