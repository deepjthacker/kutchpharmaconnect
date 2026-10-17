import React, { useState } from 'react'
import { ArrowLeft, Database, FileText, FileUp, Plus, Download, Upload, Building2, Truck, Link2 } from 'lucide-react'
import AdminCompanyCatalogUpload from './AdminCompanyCatalogUpload'
import AdminDocumentImport from './AdminDocumentImport'
import AdminSingleEntry from './AdminSingleEntry'
import AdminTools from './AdminTools'

const workflows = [
  { id: 'catalog', title: 'Company catalogue', description: 'Add or reuse companies, divisions and brands using a short paste or CSV template.', icon: Building2, action: 'Open catalogue' },
  { id: 'pdf', title: 'Distributor PDF import', description: 'Extract company names from a distributor PDF and send them to the existing review queue.', icon: FileText, action: 'Import PDF' },
  { id: 'manual', title: 'Manual entry', description: 'Add one company, distributor or distributorship directly without preparing a spreadsheet.', icon: Plus, action: 'Add a record' },
  { id: 'csv', title: 'CSV, exports and backup', description: 'Export readable directory files, validate distributorship imports, or download a JSON data backup.', icon: Database, action: 'Open data tools' },
]

export default function AdminDataWorkspace({ onBack, onOpenSubmissions, initialModule = 'overview' }) {
  const [activeModule, setActiveModule] = useState(initialModule)

  if (activeModule === 'catalog') return <AdminCompanyCatalogUpload onBack={() => setActiveModule('overview')} />
  if (activeModule === 'pdf') return <AdminDocumentImport onBack={() => setActiveModule('overview')} onOpenSubmissions={onOpenSubmissions} />
  if (activeModule === 'manual') return <AdminSingleEntry onBack={() => setActiveModule('overview')} />
  if (activeModule === 'csv') return <AdminTools onBack={() => setActiveModule('overview')} />

  return (
    <div className="admin-page">
      <div className="admin-head">
        <div>
          <button className="admin-back" onClick={onBack}><ArrowLeft size={15} /> Dashboard</button>
          <p className="section-kicker">ADMIN WORKSPACE</p>
          <h1>Data Workspace</h1>
          <p>One place for adding records, bringing in distributor lists, and exporting directory data.</p>
        </div>
      </div>

      <div className="admin-note" style={{ marginBottom: 16 }}>
        <strong>Keep the database as the master record.</strong>
        <br />
        Use direct entry for small changes. Use paste or CSV for large company lists. All distributor-submitted information stays in review until you approve and publish it.
      </div>

      <div className="admin-workspace-grid">
        {workflows.map(({ id, title, description, icon: Icon, action }) => (
          <button className="admin-workspace-card" key={id} onClick={() => setActiveModule(id)}>
            <span className="admin-workspace-icon"><Icon size={20} /></span>
            <span className="admin-workspace-copy">
              <strong>{title}</strong>
              <small>{description}</small>
              <span className="admin-workspace-action">{action} <span aria-hidden="true">→</span></span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
