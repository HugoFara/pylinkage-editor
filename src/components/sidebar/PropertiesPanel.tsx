/**
 * Properties panel for editing selected joint or link properties.
 * Allows changing joint types (revolute/prismatic/tracker) and
 * link types (ground/driver/link) without switching editor modes.
 */

import { useEditorStore } from '../../stores/editorStore';
import { useMechanismStore } from '../../stores/mechanismStore';
import type { JointType, LinkType } from '../../types/mechanism';

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  label: {
    fontSize: '12px',
    color: '#8b949e',
    minWidth: '40px',
  },
  select: {
    flex: 1,
    padding: '4px 8px',
    background: '#21262d',
    color: '#e6edf3',
    border: '1px solid #30363d',
    borderRadius: '4px',
    fontSize: '12px',
  },
  input: {
    flex: 1,
    padding: '4px 8px',
    background: '#21262d',
    color: '#e6edf3',
    border: '1px solid #30363d',
    borderRadius: '4px',
    fontSize: '12px',
    width: '60px',
  },
  title: {
    fontSize: '13px',
    color: '#e6edf3',
    fontWeight: 'bold',
  },
  empty: {
    fontSize: '12px',
    color: '#484f58',
    fontStyle: 'italic',
  },
  deleteButton: {
    padding: '4px 12px',
    background: '#da3633',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    marginTop: '4px',
  },
};

const JOINT_TYPES: { value: JointType; label: string }[] = [
  { value: 'revolute', label: 'Revolute' },
  { value: 'prismatic', label: 'Prismatic' },
  { value: 'tracker', label: 'Tracker' },
];

const LINK_TYPES: { value: LinkType; label: string }[] = [
  { value: 'link', label: 'Link' },
  { value: 'ground', label: 'Ground' },
  { value: 'driver', label: 'Driver' },
  { value: 'arc_driver', label: 'Arc Driver' },
];

export function PropertiesPanel() {
  const selectedJointId = useEditorStore((s) => s.selectedJointId);
  const selectedLinkId = useEditorStore((s) => s.selectedLinkId);
  const selectJoint = useEditorStore((s) => s.selectJoint);
  const selectLink = useEditorStore((s) => s.selectLink);

  const mechanism = useMechanismStore((s) => s.mechanism);
  const updateJoint = useMechanismStore((s) => s.updateJoint);
  const updateLink = useMechanismStore((s) => s.updateLink);
  const deleteJoint = useMechanismStore((s) => s.deleteJoint);
  const deleteLink = useMechanismStore((s) => s.deleteLink);

  if (!mechanism) return <div style={styles.empty}>No mechanism</div>;

  const selectedJoint = selectedJointId
    ? mechanism.joints.find((j) => j.id === selectedJointId)
    : null;
  const selectedLink = selectedLinkId
    ? mechanism.links.find((l) => l.id === selectedLinkId)
    : null;

  if (!selectedJoint && !selectedLink) {
    return <div style={styles.empty}>Select a joint or link</div>;
  }

  if (selectedJoint) {
    return (
      <div style={styles.container}>
        <div style={styles.title}>{selectedJoint.name || selectedJoint.id}</div>
        <div style={styles.row}>
          <span style={styles.label}>Type</span>
          <select
            style={styles.select}
            value={selectedJoint.type}
            onChange={(e) =>
              updateJoint(selectedJoint.id, { type: e.target.value as JointType })
            }
          >
            {JOINT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>X</span>
          <input
            style={styles.input}
            type="number"
            value={selectedJoint.position[0] ?? ''}
            onChange={(e) => {
              const x = parseFloat(e.target.value);
              if (!isNaN(x)) {
                updateJoint(selectedJoint.id, {
                  position: [x, selectedJoint.position[1]],
                });
              }
            }}
          />
          <span style={styles.label}>Y</span>
          <input
            style={styles.input}
            type="number"
            value={selectedJoint.position[1] ?? ''}
            onChange={(e) => {
              const y = parseFloat(e.target.value);
              if (!isNaN(y)) {
                updateJoint(selectedJoint.id, {
                  position: [selectedJoint.position[0], y],
                });
              }
            }}
          />
        </div>
        <button
          style={styles.deleteButton}
          onClick={() => {
            deleteJoint(selectedJoint.id);
            selectJoint(null);
          }}
        >
          Delete Joint
        </button>
      </div>
    );
  }

  if (selectedLink) {
    return (
      <div style={styles.container}>
        <div style={styles.title}>{selectedLink.name || selectedLink.id}</div>
        <div style={styles.row}>
          <span style={styles.label}>Type</span>
          <select
            style={styles.select}
            value={selectedLink.type}
            onChange={(e) => {
              const newType = e.target.value as LinkType;
              const updates: Partial<typeof selectedLink> = { type: newType };
              if (newType === 'driver' && !selectedLink.angular_velocity) {
                updates.angular_velocity = 0.1;
                updates.initial_angle = 0;
                if (selectedLink.joints.length > 0) {
                  updates.motor_joint = selectedLink.joints[0];
                }
              }
              updateLink(selectedLink.id, updates);
            }}
          >
            {LINK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        {(selectedLink.type === 'driver' || selectedLink.type === 'arc_driver') && (
          <div style={styles.row}>
            <span style={styles.label}>Speed</span>
            <input
              style={styles.input}
              type="number"
              step="0.01"
              value={selectedLink.angular_velocity ?? 0.1}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) {
                  updateLink(selectedLink.id, { angular_velocity: v });
                }
              }}
            />
          </div>
        )}
        <div style={{ ...styles.label, fontSize: '11px' }}>
          Joints: {selectedLink.joints.join(', ')}
        </div>
        <button
          style={styles.deleteButton}
          onClick={() => {
            deleteLink(selectedLink.id);
            selectLink(null);
          }}
        >
          Delete Link
        </button>
      </div>
    );
  }

  return null;
}
