/* @flow */

import { _Set as Set, isObject } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'

const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
// 递归地遍历一个对象以调用所有转换过的 getter，这样对象中的每个嵌套属性都被收集为“深度”依赖项。
//对对象和数组进行深度递归遍历
export function traverse (val: any) {
  //深入递归 新建一个set()
  _traverse(val, seenObjects)
  //递归结束，清空set值
  seenObjects.clear()
}
//递归添加值  传入 value 和 new Set()
function _traverse (val: any, seen: SimpleSet) {
  let i, keys
  //如果它不是一个数组
  const isA = Array.isArray(val)
  // Object.isFrozen 被一个对象是冻结的是指它不可扩展，所有属性都是不可配置的，且所有数据属性（即没有getter或setter组件的访问器的属性）都是不可写的。
  // 如果它不是一个数组且不是一个对象 或者 是否可配置（configure）可写（getter/setter） 或者 该值的是否是vnode的实例
  //一个冻结对象也是一个密封对象
  if ((!isA && !isObject(val)) || Object.isFrozen(val) || val instanceof VNode) {
    return
  }
  //如果这个值有依赖 _ob_实例
  if (val.__ob__) {
    //拿到这个值依赖的id
    const depId = val.__ob__.dep.id
    //如果这个set[] 有依赖id
    if (seen.has(depId)) {
      return
    }
    //给set[]添加实例的值
    seen.add(depId)
  }
  //如果是数组
  if (isA) {
    //这个值的length给i
    i = val.length
    // 深度遍历i，传入当前set[]
    while (i--) _traverse(val[i], seen)
  } else {
    //如果是属性 拿到属性 key
    keys = Object.keys(val)
    i = keys.length
    // 深度遍历key[i]
    while (i--) _traverse(val[keys[i]], seen)
  }
}
