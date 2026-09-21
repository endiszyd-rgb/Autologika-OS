const fs = require('node:fs')
const path = require('node:path')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default

const root = path.resolve(__dirname, '..')
const sourceDir = path.join(root, 'src')
const errors = []
const buttonEvents = new Set(['onClick', 'onDoubleClick', 'onMouseDown', 'onPointerDown', 'onDragStart'])

function parse(file, sourceType = 'module') {
  return parser.parse(fs.readFileSync(file, 'utf8'), { sourceType, plugins: ['jsx'] })
}

function propertyName(node) {
  if (node?.type === 'Identifier') return node.name
  if (node?.type === 'StringLiteral') return node.value
  return null
}

function memberPath(node, rootName) {
  const parts = []
  let current = node
  while (current && ['MemberExpression', 'OptionalMemberExpression'].includes(current.type) && !current.computed) {
    parts.unshift(propertyName(current.property))
    current = current.object
  }
  return current?.type === 'Identifier' && current.name === rootName ? parts.filter(Boolean) : null
}

function rendererFiles() {
  return fs.readdirSync(sourceDir)
    .filter(file => /\.(jsx|js)$/.test(file))
    .map(file => path.join(sourceDir, file))
}

const rendererApi = new Map()
let buttonCount = 0

for (const file of rendererFiles()) {
  const ast = parse(file)
  traverse(ast, {
    JSXOpeningElement(p) {
      if (p.node.name.type !== 'JSXIdentifier' || p.node.name.name !== 'button') return
      buttonCount++
      const attrs = p.node.attributes.filter(x => x.type === 'JSXAttribute')
      const hasEvent = attrs.some(x => buttonEvents.has(x.name.name))
      const isSubmit = attrs.some(x => x.name.name === 'type' && x.value?.type === 'StringLiteral' && x.value.value === 'submit')
      if (!hasEvent && !isSubmit) errors.push(`${path.relative(root, file)}:${p.node.loc.start.line} — przycisk nie ma akcji`)
    },
    MemberExpression(p) {
      if (['MemberExpression', 'OptionalMemberExpression'].includes(p.parent?.type) && p.parent.object === p.node) return
      const parts = memberPath(p.node, 'api')
      if (!parts?.length) return
      const key = parts.length > 1 ? parts.slice(0, 2).join('.') : parts[0]
      rendererApi.set(key, `${path.relative(root, file)}:${p.node.loc.start.line}`)
    },
    OptionalMemberExpression(p) {
      if (['MemberExpression', 'OptionalMemberExpression'].includes(p.parent?.type) && p.parent.object === p.node) return
      const parts = memberPath(p.node, 'api')
      if (!parts?.length) return
      const key = parts.length > 1 ? parts.slice(0, 2).join('.') : parts[0]
      rendererApi.set(key, `${path.relative(root, file)}:${p.node.loc.start.line}`)
    }
  })
}

const preloadFile = path.join(root, 'electron', 'preload.cjs')
const preloadAst = parse(preloadFile, 'script')
const exposedApi = new Set()
const invokedChannels = new Map()

function collectExposed(object, prefix = []) {
  if (object?.type !== 'ObjectExpression') return
  for (const property of object.properties) {
    if (!['ObjectProperty', 'ObjectMethod'].includes(property.type)) continue
    const key = propertyName(property.key)
    if (!key) continue
    if (property.value?.type === 'ObjectExpression') collectExposed(property.value, [...prefix, key])
    else exposedApi.add([...prefix, key].join('.'))
  }
}

traverse(preloadAst, {
  CallExpression(p) {
    const callee = p.node.callee
    if (callee.type === 'MemberExpression' && callee.object?.name === 'contextBridge' && callee.property?.name === 'exposeInMainWorld') {
      collectExposed(p.node.arguments[1])
    }
    if (callee.type === 'MemberExpression' && callee.object?.name === 'ipcRenderer' && callee.property?.name === 'invoke') {
      const channel = p.node.arguments[0]
      if (channel?.type === 'StringLiteral') invokedChannels.set(channel.value, p.node.loc.start.line)
    }
  }
})

for (const [method, location] of rendererApi) {
  if (!exposedApi.has(method)) errors.push(`${location} — api.${method} nie jest wystawione przez preload`)
}

const mainFile = path.join(root, 'electron', 'main.cjs')
const mainAst = parse(mainFile, 'script')
const handledChannels = new Set()
traverse(mainAst, {
  CallExpression(p) {
    const callee = p.node.callee
    if (callee.type !== 'MemberExpression' || callee.object?.name !== 'ipcMain' || callee.property?.name !== 'handle') return
    const channel = p.node.arguments[0]
    if (channel?.type === 'StringLiteral') handledChannels.add(channel.value)
  }
})

for (const [channel, line] of invokedChannels) {
  if (!handledChannels.has(channel)) errors.push(`electron/preload.cjs:${line} — kanał ${channel} nie ma ipcMain.handle`)
}

const mainSourceAst = parse(path.join(sourceDir, 'main.jsx'))
const navPages = new Set()
const renderedPages = new Set()
traverse(mainSourceAst, {
  VariableDeclarator(p) {
    if (p.node.id.type !== 'Identifier' || p.node.id.name !== 'navSections' || p.node.init?.type !== 'ArrayExpression') return
    for (const section of p.node.init.elements) {
      const items = section?.elements?.[1]
      if (items?.type !== 'ArrayExpression') continue
      for (const item of items.elements) {
        const id = item?.elements?.[0]
        if (id?.type === 'StringLiteral') navPages.add(id.value)
      }
    }
  },
  BinaryExpression(p) {
    if (!['===', '=='].includes(p.node.operator)) return
    const { left, right } = p.node
    if (left.type === 'Identifier' && left.name === 'page' && right.type === 'StringLiteral') renderedPages.add(right.value)
    if (right.type === 'Identifier' && right.name === 'page' && left.type === 'StringLiteral') renderedPages.add(left.value)
  }
})

for (const page of navPages) {
  if (!renderedPages.has(page)) errors.push(`src/main.jsx — pozycja menu „${page}” nie ma podłączonego ekranu`)
}

if (errors.length) {
  console.error(`AUDYT POŁĄCZEŃ UI: ${errors.length} problemów`)
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log(`AUDYT POŁĄCZEŃ UI: OK · ${buttonCount} przycisków · ${rendererApi.size} metod API · ${invokedChannels.size} kanałów IPC · ${navPages.size} ekranów menu`)
}
