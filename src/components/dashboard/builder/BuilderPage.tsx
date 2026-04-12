import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import {
  Workflow, Plus, AlertTriangle, X, Check, Loader2,
  MousePointerClick, ChevronRight, GitBranch, Pencil, Trash2,
  ZoomIn, ZoomOut, Maximize2, MessageSquare, Bot, Search,
  GripVertical, Play, Image, FileText, Video, Link, Paperclip
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDashboard } from '@/contexts/DashboardContext'
import { supabase } from '@/integrations/supabase/client'
import ButtonOptionInput from '@/components/ButtonOptionInput'
import CanvasNode from './CanvasNode'
import CanvasEdges from './CanvasEdges'
import ChatPreview from './ChatPreview'
import TemplatesModal from './TemplatesModal'

// Layout constants
const NODE_W = 220
const NODE_H = 80
const H_GAP = 100
const V_GAP = 40
const CANVAS_PAD = 80

type NodePosition = { id: string; x: number; y: number; parentId: string | null }

function layoutNodes(rootQuestions: any[], getChildren: (id: string) => any[]): NodePosition[] {
  const positions: NodePosition[] = []
  let globalYOffset = 0

  // Place the greeting trigger node
  positions.push({ id: '__trigger__', x: CANVAS_PAD, y: CANVAS_PAD + 120, parentId: null })

  function measure(node: any, level: number): number {
    const kids = getChildren(node.id)
    if (kids.length === 0) return NODE_H
    let totalHeight = 0
    kids.forEach((k, i) => {
      if (i > 0) totalHeight += V_GAP
      totalHeight += measure(k, level + 1)
    })
    return Math.max(NODE_H, totalHeight)
  }

  // First pass: measure total height of each root tree
  const rootHeights = rootQuestions.map(q => measure(q, 0))
  const totalHeight = rootHeights.reduce((sum, h, i) => sum + h + (i > 0 ? V_GAP : 0), 0)

  // Start Y so the tree is centered relative to trigger
  const startY = CANVAS_PAD + 120 - totalHeight / 2 + NODE_H / 2

  function placeNode(node: any, level: number, yStart: number, parentId: string | null): number {
    const kids = getChildren(node.id)
    const x = CANVAS_PAD + (level + 1) * (NODE_W + H_GAP)

    if (kids.length === 0) {
      positions.push({ id: node.id, x, y: yStart, parentId })
      return NODE_H
    }

    let currentY = yStart
    const childStarts: number[] = []
    kids.forEach((k, i) => {
      if (i > 0) currentY += V_GAP
      childStarts.push(currentY)
      const h = placeNode(k, level + 1, currentY, node.id)
      currentY += h
    })

    // Center parent vertically among children
    const firstChildY = childStarts[0]
    const lastChildY = childStarts[childStarts.length - 1]
    const nodeY = (firstChildY + lastChildY) / 2

    positions.push({ id: node.id, x, y: nodeY, parentId })
    return currentY - yStart
  }

  let cY = startY
  rootQuestions.forEach((q, i) => {
    if (i > 0) cY += V_GAP
    const used = placeNode(q, 0, cY, '__trigger__')
    cY += used
  })

  return positions
}

export default function BuilderPage() {
  const {
    user, chatbot, qaPairs, rootQuestions, mainMenuCount, subOptionCount,
    showAddQuestion, setShowAddQuestion,
    mainQuestionForm, mainButtonOptions, error,
    handleMainQuestionChange, handleMainButtonOptionChange,
    addMainButtonOptionField, removeMainButtonOptionField,
    handleAddMainQuestion, savingMainQuestion,
    setMainQuestionForm, setMainButtonOptions, getChildren
  } = useDashboard()

  const canvasRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(0.85)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  const inputCls = 'w-full px-4 py-2.5 rounded-xl bg-[hsl(var(--surface-raised))] border border-input text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm'
  const textareaCls = inputCls + ' resize-none'
  const labelCls = 'block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider'

  // Compute layout positions
  const positions = useMemo(() => layoutNodes(rootQuestions, getChildren), [qaPairs, rootQuestions])

  // Filter for search
  const filteredIds = useMemo(() => {
    if (!searchQuery.trim()) return null
    const q = searchQuery.toLowerCase()
    return new Set(
      qaPairs
        .filter(p => p.question_text.toLowerCase().includes(q) || p.answer_text.toLowerCase().includes(q))
        .map(p => p.id)
    )
  }, [searchQuery, qaPairs])

  // Find node data by id
  const getNodeData = useCallback((id: string) => qaPairs.find(q => q.id === id), [qaPairs])

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return
    setIsPanning(true)
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
  }, [isPanning, panStart])

  const handleMouseUp = useCallback(() => setIsPanning(false), [])

  // Zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.05 : 0.05
    setZoom(z => Math.min(2, Math.max(0.25, z + delta)))
  }, [])

  const fitToView = useCallback(() => {
    if (positions.length === 0) { setPan({ x: 0, y: 0 }); setZoom(0.85); return }
    const canvas = canvasRef.current
    if (!canvas) return
    const maxX = Math.max(...positions.map(p => p.x)) + NODE_W + CANVAS_PAD
    const maxY = Math.max(...positions.map(p => p.y)) + NODE_H + CANVAS_PAD
    const minX = Math.min(...positions.map(p => p.x)) - CANVAS_PAD
    const minY = Math.min(...positions.map(p => p.y)) - CANVAS_PAD
    const cw = canvas.clientWidth
    const ch = canvas.clientHeight
    const scaleX = cw / (maxX - minX)
    const scaleY = ch / (maxY - minY)
    const newZoom = Math.min(1.2, Math.max(0.3, Math.min(scaleX, scaleY) * 0.9))
    setZoom(newZoom)
    setPan({
      x: (cw - (maxX - minX) * newZoom) / 2 - minX * newZoom,
      y: (ch - (maxY - minY) * newZoom) / 2 - minY * newZoom,
    })
  }, [positions])

  // Auto-fit on first load
  useEffect(() => {
    if (positions.length > 1) fitToView()
  }, [positions.length > 1])

  return (
    <div className="h-[calc(100vh-52px)] flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
            <Workflow size={16} className="text-primary" />
          </div>
          <div>
            <h2 className="font-display font-bold text-sm text-foreground">Flow Builder</h2>
            <p className="text-[10px] text-muted-foreground">{mainMenuCount} nodes · {subOptionCount} sub-options</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search nodes..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-muted/50 border border-border text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none w-40 transition-all"
            />
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 bg-muted/40 rounded-lg border border-border p-0.5">
            <button onClick={() => setZoom(z => Math.max(0.25, z - 0.15))} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <ZoomOut size={14} />
            </button>
            <span className="text-[10px] font-mono text-muted-foreground w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.15))} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <ZoomIn size={14} />
            </button>
            <button onClick={fitToView} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Fit to view">
              <Maximize2 size={14} />
            </button>
          </div>

          {/* Preview toggle */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { setShowPreview(v => !v); setShowAddQuestion(false); setSelectedNode(null) }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${showPreview ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-border'}`}
          >
            <Play size={12} /> Preview
          </motion.button>

          {/* Add node */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { setShowAddQuestion(true); setShowPreview(false); setMainQuestionForm({ question_text: '', answer_text: '', media_url: '', media_type: '' }); setMainButtonOptions([{ id: Date.now(), button_text: '', answer: '' }]) }}
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-primary/90 transition-colors"
          >
            <Plus size={13} /> Add Node
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => setShowTemplates(true)}
            className="inline-flex items-center gap-1.5 bg-muted border border-border text-foreground px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-muted/80 transition-colors"
          >
            🧩 Templates
          </motion.button>
        </div>
      </div>

      {/* Warning */}
      <AnimatePresence>
        {mainMenuCount >= 3 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden shrink-0"
          >
            <div className="bg-warning/10 border-b border-warning/20 text-warning px-4 py-2 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle size={13} /> WhatsApp supports max 3 buttons. Only the first 3 root nodes will show.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Canvas background */}
        <div
          ref={canvasRef}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          style={{
            backgroundImage: `radial-gradient(circle, hsl(var(--muted-foreground) / 0.08) 1px, transparent 1px)`,
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Transform layer */}
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          >
            {/* SVG edges */}
            <CanvasEdges positions={positions} nodeWidth={NODE_W} nodeHeight={NODE_H} />

            {/* Trigger node */}
            {positions.find(p => p.id === '__trigger__') && (
              <div
                data-node
                className="absolute"
                style={{
                  left: positions.find(p => p.id === '__trigger__')!.x,
                  top: positions.find(p => p.id === '__trigger__')!.y,
                  width: NODE_W,
                  height: NODE_H,
                }}
              >
                <div className="h-full rounded-xl border-2 border-primary/30 bg-card flex items-center gap-3 px-4 cursor-default hover:border-primary/50 transition-colors shadow-lg shadow-primary/5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shrink-0">
                    <Bot size={20} className="text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">Greeting</p>
                    <p className="text-[10px] text-muted-foreground truncate">Start of conversation</p>
                  </div>
                  {/* Output port */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full border-2 border-primary bg-card z-10" />
                </div>
              </div>
            )}

            {/* Flow nodes */}
            {positions
              .filter(p => p.id !== '__trigger__')
              .map(pos => {
                const nodeData = getNodeData(pos.id)
                if (!nodeData) return null
                const children = getChildren(pos.id)
                const isMain = pos.parentId === '__trigger__'
                const dimmed = filteredIds !== null && !filteredIds.has(pos.id)

                return (
                  <CanvasNode
                    key={pos.id}
                    node={nodeData}
                    x={pos.x}
                    y={pos.y}
                    width={NODE_W}
                    height={NODE_H}
                    isMain={isMain}
                    hasChildren={children.length > 0}
                    childCount={children.length}
                    isSelected={selectedNode === pos.id}
                    isDimmed={dimmed}
                    onClick={() => setSelectedNode(selectedNode === pos.id ? null : pos.id)}
                  />
                )
              })}
          </div>
        </div>

        {/* Empty state overlay */}
        {rootQuestions.length === 0 && !showAddQuestion && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center pointer-events-auto"
            >
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mx-auto mb-5">
                <Workflow size={36} className="text-muted-foreground/30" />
              </div>
              <p className="text-foreground text-sm font-semibold">No nodes yet</p>
              <p className="text-muted-foreground text-xs mt-1.5 max-w-xs mx-auto mb-4">Click "Add Node" to start building your chatbot flow</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowAddQuestion(true); setMainQuestionForm({ question_text: '', answer_text: '', media_url: '', media_type: '' }); setMainButtonOptions([{ id: Date.now(), button_text: '', answer: '' }]) }}
                  className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
                >
                  <Plus size={14} /> Add First Node
                </button>
                <button
                  onClick={() => setShowTemplates(true)}
                  className="inline-flex items-center gap-1.5 bg-muted border border-border text-foreground px-4 py-2 rounded-lg text-sm font-bold hover:bg-muted/80 transition-colors"
                >
                  🧩 Use Template
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Add node panel — slides in from right */}
        <AnimatePresence>
          {showAddQuestion && (
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute right-0 top-0 bottom-0 w-80 bg-card border-l border-border shadow-2xl overflow-y-auto z-20"
            >
              <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-primary/8 via-primary/3 to-transparent flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Plus size={14} className="text-primary" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground">New Node</h4>
                </div>
                <button onClick={() => setShowAddQuestion(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={14} /></button>
              </div>
              <form onSubmit={handleAddMainQuestion} className="p-4 space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className={labelCls}>Button Label</label>
                    <span className={`text-xs font-mono tabular-nums ${mainQuestionForm.question_text.length > 20 ? 'text-destructive' : 'text-muted-foreground'}`}>{mainQuestionForm.question_text.length}/20</span>
                  </div>
                  <input type="text" name="question_text" value={mainQuestionForm.question_text} onChange={handleMainQuestionChange} required maxLength={30} className={inputCls} placeholder="e.g., Services" />
                </div>
                <div>
                  <label className={labelCls}>Response Message</label>
                  <textarea name="answer_text" value={mainQuestionForm.answer_text} onChange={handleMainQuestionChange} required rows={3} className={textareaCls} placeholder="Message sent when tapped" />
                </div>
                <MediaAttachmentSection
                  mediaUrl={mainQuestionForm.media_url}
                  mediaType={mainQuestionForm.media_type}
                  onUrlChange={url => setMainQuestionForm(f => ({ ...f, media_url: url }))}
                  onTypeChange={type => setMainQuestionForm(f => ({ ...f, media_type: type }))}
                  chatbotId={chatbot?.id ?? ''}
                  userId={user?.id ?? ''}
                />
                <div className="pt-2 border-t border-border">
                  <label className={labelCls + ' mb-3'}>Sub-Options (optional)</label>
                  {mainButtonOptions.map(opt => <ButtonOptionInput key={opt.id} option={opt} onChange={handleMainButtonOptionChange} onRemove={removeMainButtonOptionField} canRemove={mainButtonOptions.length > 1} />)}
                  <button type="button" onClick={addMainButtonOptionField} className="text-primary text-xs font-bold hover:underline mt-1">+ Add option</button>
                </div>
                {error && <p className="text-destructive text-xs">{error}</p>}
                <div className="flex gap-2 pt-1">
                  <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={savingMainQuestion}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50">
                    {savingMainQuestion ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Create
                  </motion.button>
                  <button type="button" onClick={() => setShowAddQuestion(false)}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancel</button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selected node detail panel */}
        <AnimatePresence>
          {selectedNode && !showAddQuestion && !showPreview && (
            <SelectedNodePanel nodeId={selectedNode} onClose={() => setSelectedNode(null)} />
          )}
        </AnimatePresence>

        {/* Chat preview panel */}
        <AnimatePresence>
          {showPreview && (
            <ChatPreview onClose={() => setShowPreview(false)} />
          )}
        </AnimatePresence>
      </div>

      {/* Templates modal */}
      <AnimatePresence>
        {showTemplates && (
          <TemplatesModal onClose={() => setShowTemplates(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}

function SelectedNodePanel({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const {
    user, chatbot, qaPairs, getChildren, editingQuestion, editQuestionForm, setEditQuestionForm,
    handleStartEditQuestion, handleSaveQuestionEdit, handleDeleteQuestion,
    handleEditQuestionFormChange, setEditingQuestion, savingEdit, handleAddSubOptions
  } = useDashboard()

  const node = qaPairs.find(q => q.id === nodeId)
  const children = node ? getChildren(node.id) : []
  const [showAddButtons, setShowAddButtons] = useState(false)
  const [localButtonOptions, setLocalButtonOptions] = useState([{ id: Date.now(), button_text: '', answer: '' }])
  const [savingButtons, setSavingButtons] = useState(false)
  const isEditing = editingQuestion === nodeId

  const inputCls = 'w-full px-4 py-2.5 rounded-xl bg-[hsl(var(--surface-raised))] border border-input text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm'
  const textareaCls = inputCls + ' resize-none'
  const labelCls = 'block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider'

  const handleSaveLocalButtons = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingButtons(true)
    const valid = localButtonOptions.filter(opt => opt.button_text.trim() && opt.answer.trim())
    const success = await handleAddSubOptions(nodeId, valid)
    if (success) {
      setLocalButtonOptions([{ id: Date.now(), button_text: '', answer: '' }])
      setShowAddButtons(false)
    }
    setSavingButtons(false)
  }

  if (!node) return null

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="absolute right-0 top-0 bottom-0 w-80 bg-card border-l border-border shadow-2xl overflow-y-auto z-20"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <MessageSquare size={14} className="text-primary" />
          </div>
          <h4 className="text-sm font-bold text-foreground truncate">{node.question_text}</h4>
        </div>
        <div className="flex items-center gap-1">
          {!isEditing && (
            <>
              <button onClick={() => handleStartEditQuestion(node)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                <Pencil size={13} />
              </button>
              <button onClick={() => { handleDeleteQuestion(node.id); onClose() }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 size={13} />
              </button>
            </>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={14} /></button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <AnimatePresence mode="wait">
          {isEditing ? (
            <motion.form
              key="edit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={(e) => handleSaveQuestionEdit(e, nodeId)}
              className="space-y-3"
            >
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className={labelCls}>Button Label</label>
                  <span className={`text-xs font-mono tabular-nums ${editQuestionForm.question_text.length > 20 ? 'text-destructive' : 'text-muted-foreground'}`}>{editQuestionForm.question_text.length}/20</span>
                </div>
                <input type="text" name="question_text" value={editQuestionForm.question_text} onChange={handleEditQuestionFormChange} required maxLength={30} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Response</label>
                <textarea name="answer_text" value={editQuestionForm.answer_text} onChange={handleEditQuestionFormChange} required rows={4} className={textareaCls} />
              </div>
              <MediaAttachmentSection
                mediaUrl={editQuestionForm.media_url}
                mediaType={editQuestionForm.media_type}
                onUrlChange={url => setEditQuestionForm(f => ({ ...f, media_url: url }))}
                onTypeChange={type => setEditQuestionForm(f => ({ ...f, media_type: type }))}
                chatbotId={chatbot?.id ?? ''}
                userId={user?.id ?? ''}
              />
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={savingEdit}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
                </motion.button>
                <button type="button" onClick={() => setEditingQuestion(null)}
                  className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancel</button>
              </div>
            </motion.form>
          ) : (
            <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Info */}
              <div>
                <label className={labelCls}>Response</label>
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-xl p-3 border border-border/30">{node.answer_text}</p>
              </div>
              {node.media_url && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/15 text-xs text-primary font-semibold">
                  {node.media_type === 'image' ? <Image size={13} /> : node.media_type === 'video' ? <Video size={13} /> : <FileText size={13} />}
                  <span className="capitalize">{node.media_type}</span>
                  <span className="text-muted-foreground font-normal truncate ml-1">{node.media_url}</span>
                </div>
              )}

              {/* Children */}
              {children.length > 0 && (
                <div>
                  <label className={labelCls}>Sub-Options ({children.length})</label>
                  <div className="space-y-1.5">
                    {children.map(c => (
                      <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/30 text-xs">
                        <ChevronRight size={12} className="text-muted-foreground shrink-0" />
                        <span className="text-foreground font-medium truncate">{c.question_text}</span>
                        <span className="text-muted-foreground ml-auto shrink-0">{getChildren(c.id).length} sub</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add sub-options */}
              {showAddButtons ? (
                <div className="bg-muted/20 rounded-xl p-3 border border-border/30">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-xs font-bold text-foreground uppercase tracking-wider">Add Sub-Options</h5>
                    <button onClick={() => { setShowAddButtons(false); setLocalButtonOptions([{ id: Date.now(), button_text: '', answer: '' }]) }}
                      className="p-1 rounded hover:bg-muted text-muted-foreground"><X size={12} /></button>
                  </div>
                  <form onSubmit={handleSaveLocalButtons} className="space-y-2">
                    {localButtonOptions.map(opt => (
                      <ButtonOptionInput key={opt.id} option={opt}
                        onChange={(id, field, value) => setLocalButtonOptions(localButtonOptions.map(o => o.id === id ? { ...o, [field]: value } : o))}
                        onRemove={(id) => setLocalButtonOptions(localButtonOptions.filter(o => o.id !== id))}
                        canRemove={localButtonOptions.length > 1} />
                    ))}
                    <button type="button" onClick={() => setLocalButtonOptions([...localButtonOptions, { id: Date.now() + Math.random(), button_text: '', answer: '' }])}
                      className="text-primary text-xs font-semibold hover:underline">+ Add another</button>
                    <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={savingButtons}
                      className="w-full inline-flex items-center justify-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                      {savingButtons ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
                    </motion.button>
                  </form>
                </div>
              ) : (
                <button
                  onClick={() => { setShowAddButtons(true); setLocalButtonOptions([{ id: Date.now(), button_text: '', answer: '' }]) }}
                  className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:bg-primary/10 px-3 py-2 rounded-lg transition-colors w-full justify-center border border-dashed border-primary/20"
                >
                  <Plus size={13} /> Add sub-option
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ── Media Attachment Section ──────────────────────────────────────────────────
const ACCEPT_MAP: Record<string, string> = {
  image: 'image/jpeg,image/png,image/webp,image/gif',
  document: 'application/pdf',
  video: 'video/mp4,video/3gpp',
}

function MediaAttachmentSection({
  mediaUrl, mediaType, onUrlChange, onTypeChange, chatbotId, userId,
}: {
  mediaUrl: string
  mediaType: string
  onUrlChange: (url: string) => void
  onTypeChange: (type: string) => void
  chatbotId: string
  userId: string
}) {
  const [open, setOpen] = useState(!!mediaUrl)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [useUrl, setUseUrl] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const mediaTypes = [
    { value: 'image', label: 'Image', icon: <Image size={12} /> },
    { value: 'document', label: 'PDF', icon: <FileText size={12} /> },
    { value: 'video', label: 'Video', icon: <Video size={12} /> },
    { value: 'link', label: 'Link', icon: <Link size={12} /> },
  ]

  const activeType = mediaType || 'image'
  const isLink = activeType === 'link'

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')

    const detectedType = file.type.startsWith('image') ? 'image' : file.type.startsWith('video') ? 'video' : 'document'
    onTypeChange(detectedType)

    const ext = file.name.split('.').pop()
    const path = `${userId}/${chatbotId}/${Date.now()}.${ext}`

    const { error } = await supabase.storage.from('chatbot-media').upload(path, file, { upsert: false })
    if (error) {
      setUploadError('Upload failed: ' + error.message)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('chatbot-media').getPublicUrl(path)
    onUrlChange(publicUrl)
    setUploading(false)
  }

  const handleRemove = () => {
    onUrlChange('')
    onTypeChange('')
    setOpen(false)
    setUploadError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="border-t border-border pt-3">
      <button type="button" onClick={() => { if (open) handleRemove(); else setOpen(true) }}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary font-semibold transition-colors">
        <Paperclip size={12} /> {open ? 'Remove media' : 'Attach media (optional)'}
      </button>

      {open && (
        <div className="mt-3 space-y-2.5">
          {/* Type selector */}
          <div className="flex gap-1.5 flex-wrap">
            {mediaTypes.map(t => (
              <button key={t.value} type="button"
                onClick={() => { onTypeChange(t.value); onUrlChange(''); setUseUrl(false); if (fileInputRef.current) fileInputRef.current.value = '' }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                  activeType === t.value
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-muted/30 text-muted-foreground border-border hover:border-primary/20'
                }`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Link type — URL input only, no file upload */}
          {isLink && (
            <div className="relative">
              <Link size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
              <input type="url" value={mediaUrl} onChange={e => onUrlChange(e.target.value)}
                placeholder="Paste YouTube, website, or any URL…"
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-[hsl(var(--surface-raised))] border border-input text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-xs" />
              <p className="text-[9px] text-muted-foreground/50 mt-1">Sent as a clickable link with rich preview (YouTube, maps, websites)</p>
            </div>
          )}

          {/* Upload area for image / pdf / video */}
          {!isLink && !useUrl && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_MAP[activeType]}
                onChange={handleFileChange}
                className="hidden"
              />
              {mediaUrl ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/15">
                  {activeType === 'image' ? <Image size={13} className="text-primary shrink-0" /> : activeType === 'video' ? <Video size={13} className="text-primary shrink-0" /> : <FileText size={13} className="text-primary shrink-0" />}
                  <span className="text-xs text-foreground font-medium truncate flex-1">{mediaUrl.split('/').pop()}</span>
                  <button type="button" onClick={() => { onUrlChange(''); if (fileInputRef.current) fileInputRef.current.value = '' }}
                    className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors shrink-0">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="w-full flex flex-col items-center gap-2 px-4 py-5 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/3 transition-all text-center disabled:opacity-50">
                  {uploading
                    ? <><Loader2 size={20} className="text-primary animate-spin" /><span className="text-xs text-muted-foreground">Uploading…</span></>
                    : <><Paperclip size={18} className="text-muted-foreground/50" /><span className="text-xs font-semibold text-foreground">Click to upload {activeType}</span><span className="text-[10px] text-muted-foreground/60">{activeType === 'image' ? 'JPG, PNG, WEBP, GIF' : activeType === 'video' ? 'MP4, 3GP' : 'PDF'} · max 50 MB</span></>
                  }
                </button>
              )}
              {activeType === 'image' && mediaUrl && (
                <img src={mediaUrl} alt="preview" className="w-full max-h-32 object-cover rounded-xl border border-border" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              )}
            </>
          )}

          {/* URL fallback for image/pdf/video */}
          {!isLink && useUrl && (
            <div className="relative">
              <Link size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
              <input type="url" value={mediaUrl} onChange={e => onUrlChange(e.target.value)}
                placeholder="Paste public URL (https://...)"
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-[hsl(var(--surface-raised))] border border-input text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-xs" />
            </div>
          )}

          {uploadError && <p className="text-[10px] text-destructive">{uploadError}</p>}

          {!isLink && (
            <button type="button" onClick={() => { setUseUrl(v => !v); onUrlChange('') }}
              className="text-[10px] text-muted-foreground/60 hover:text-primary transition-colors underline underline-offset-2">
              {useUrl ? 'Upload from device instead' : 'Use a URL instead'}
            </button>
          )}

          <p className="text-[9px] text-muted-foreground/50">Sent to the customer before the reply buttons</p>
        </div>
      )}
    </div>
  )
}
