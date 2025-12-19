/**
 * Returns the x, y coordinates of the caret in a textarea/input.
 * Based on basic replication of standard textarea-caret behavior.
 */

export function getCaretCoordinates(element: HTMLTextAreaElement | HTMLInputElement, position: number) {
    const {
        boxSizing,
        width,
        height,
        borderWidth,
        paddingTop,
        paddingRight,
        paddingBottom,
        paddingLeft,
        lineHeight,
        textDecoration,
        fontFamily,
        fontSize,
        fontStyle,
        fontVariant,
        fontWeight,
        letterSpacing,
        overflowX,
        overflowY,
        textAlign,
        textIndent,
        textTransform,
        whiteSpace,
        wordBreak,
        wordSpacing,
    } = window.getComputedStyle(element)

    // Create a div that mirrors the textarea styles
    const div = document.createElement('div')
    div.id = 'input-textarea-caret-position-mirror-div'
    document.body.appendChild(div)

    const style = div.style
    const isInput = element.nodeName === 'INPUT'

    // Copy styles
    style.whiteSpace = 'pre-wrap'
    if (!isInput) style.wordWrap = 'break-word'

    style.position = 'absolute'
    style.visibility = 'hidden'
    style.boxSizing = boxSizing
    style.width = width
    style.height = height
    style.overflow = 'hidden'

    style.borderWidth = borderWidth
    style.paddingTop = paddingTop
    style.paddingRight = paddingRight
    style.paddingBottom = paddingBottom
    style.paddingLeft = paddingLeft

    style.fontFamily = fontFamily
    style.fontSize = fontSize
    style.fontStyle = fontStyle
    style.fontVariant = fontVariant
    style.fontWeight = fontWeight

    style.letterSpacing = letterSpacing
    style.lineHeight = lineHeight
    style.textDecoration = textDecoration
    style.textAlign = textAlign
    style.textIndent = textIndent
    style.textTransform = textTransform
    style.wordBreak = wordBreak
    style.wordSpacing = wordSpacing

    // Content up to caret
    div.textContent = element.value.substring(0, position)

    // Create a span for the caret position
    const span = document.createElement('span')
    span.textContent = element.value.substring(position) || '.'  // minimal content to give it height
    div.appendChild(span)

    const coordinates = {
        top: span.offsetTop + parseInt(borderWidth),
        left: span.offsetLeft + parseInt(borderWidth),
        height: parseInt(lineHeight)
    }

    document.body.removeChild(div)
    return coordinates
}
