import { memo } from 'react'
import { motion } from 'framer-motion'
import { MessageSquare, GitBranch, MousePointerClick } from 'lucide-react'

interface CanvasNodeProps {
  node: any
  x: number
  y: number
  width: number
  height: number
  isMain: boolean
  hasChildren: boolean
  childCount: number
  isSelected: boolean
  isDimmed: boolean
  onClick: () => void
}

function CanvasNodeInner({ node, x, y, width, height, isMain, hasChildren, childCount, isSelected, isDimmed, onClick }: CanvasNodeProps) {
  return (
    <motion.div
      data-node
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: isDimmed ? 0.3 : 1,
        scale: 1,
      }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="absolute cursor-pointer"
      style={{ left: x, top: y, width, height }}
      onClick={onClick}
    >
      <motion.div
        whileHover={{ scale: 1.03, y: -2 }}
        whileTap={{ scale: 0.98 }}
        className={`h-full rounded-xl border-2 transition-all duration-200 flex items-center gap-3 px-4 ${
          isSelected
            ? 'border-primary bg-card shadow-lg shadow-primary/15 ring-2 ring-primary/20'
            : isMain
              ? 'border-border bg-card hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5'
              : 'border-border/50 bg-card/80 hover:border-border hover:shadow-md'
        }`}
      >
        {/* Input port */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-muted-foreground/30 bg-card z-10 hover:border-primary hover:bg-primary/20 transition-colors" />

        {/* Icon */}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          isMain
            ? 'bg-gradient-to-br from-primary/25 to-primary/10'
            : 'bg-muted/60'
        }`}>
          {isMain
            ? <MousePointerClick size={16} className="text-primary" />
            : <MessageSquare size={14} className="text-muted-foreground" />
          }
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground truncate leading-tight">{node.question_text}</p>
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{node.answer_text}</p>
        </div>

        {/* Child count badge */}
        {hasChildren && (
          <div className="absolute -bottom-2 right-3 inline-flex items-center gap-0.5 bg-muted border border-border rounded-full px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
            <GitBranch size={8} /> {childCount}
          </div>
        )}

        {/* Output port */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full border-2 border-primary/40 bg-card z-10 hover:border-primary hover:bg-primary/20 transition-colors" />
      </motion.div>
    </motion.div>
  )
}

const CanvasNode = memo(CanvasNodeInner)
export default CanvasNode
