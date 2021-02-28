/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

// 返回一个由指定对象的所有自身属性的属性名（包括不可枚举属性但不包括Symbol值作为名称的属性）组成的数组。4
//返回该数组的所有属性名称
const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
// 在一些方法中我们可能想禁止观察在一个组件里的update和cumputation中 默认为true
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */

//当开始编译后，对数据进行监听 Observer
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that have this object as root $data

  constructor (value: any) {
    this.value = value
    //为监听值 新建收集依赖实例
    this.dep = new Dep()
    this.vmCount = 0
    //defineProperty 对值的属性进行定义，可枚举，可配置，可修改
    def(value, '__ob__', this)
    // 如果监听的数据是数组的话 给数组重写方法属性
    if (Array.isArray(value)) {
      // 判断是否支持使用proto
      if (hasProto) {
        // 如果支持给这个数组的实例上面添加定义数组
        protoAugment(value, arrayMethods)
      } else {
        // 如果不支持_proto_
        copyAugment(value, arrayMethods, arrayKeys)
      }
      //观察数组 遍历数组，得到每个值得观察实例以及观察数量
      this.observeArray(value)
    } else {
      //如果是对象的话，递归遍历数据给数据定义get,set 方法 监听属性
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   */
  walk (obj: Object) {
    // 遍历数据的key 循环定义相应的方法
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      //定义响应式方法 让属性都有observer实例 都有set/get方法 都添加依赖
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  //遍历数组的每个item 递归，观察数组中的每个值的方法
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      // 遍历每个值，得到每个值的observe实例，以及观察者数量 如果没有observer的定义一个observer实例
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  //目标的原型指向src
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
//值，定义方法 arrayMethods，定义名字 key
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  //遍历需要定义的名字，依次进行定义
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    // 给目标定义方法名属性  因为是数组所以 ，如果是数组的话可以枚举
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
// 尝试去创建一个 observer实例化后的value值，返回一个new observer 如果成功的被观察
//或者value已经被实例化

export function observe (value: any, asRootData: ?boolean): Observer | void {
  // 如果传入值是对象 或 传入值是虚拟节点 VNode的实例，直接返回
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  //定义一个变量，它的类型是Observer或没有返回值
  let ob: Observer | void
  //通过hasOwnProperty判断当前函数是否有__ob__属性，且这个值是否属于Observer得实例
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    // 如果都符合，将该值的value的ob赋给ob
    ob = value.__ob__

    //如果这个值应该被观察（一般为true，当组件update，computed钩子函数调用时可能为不允许被观察）
    //判断在当前平台是否可以被渲染，Vue是否可以实例化 如果在未知平台，可能是非服务器
    //判断是否是数组或者是对象
    //判断是否有。。。isExtensible
    //是否有isVue属性
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    //符合这些条件返回一个Observer当前值的实例
    ob = new Observer(value)
  }
  // 如果是asrootData而且ob有值 vmCount数量++
  if (asRootData && ob) {
    ob.vmCount++
  }
  //返回value的observe实例，和观察数据数量
  return ob
}

/**
 * Define a reactive property on an Object.
 */
//定义一个对象的属性
export function defineReactive (
  //传入属性以及属性类型
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // dep 收集依赖 收集依赖 通知依赖更新
  const dep = new Dep()

  // function getOwnPropertyDescriptors(obj) { const result = {}; for (let key of Reflect.ownKeys(obj)) { result[key] = Object.getOwnPropertyDescriptor(obj, key); } return result; }
  //复制一个obj对象中的属性值且完整复制getter/setter等prototype
  // 返回某个对象属性的描述对象（ descriptor ）。
  const property = Object.getOwnPropertyDescriptor(obj, key)
  //如果这个属性值是不可配置的，那么直接返回
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  //迎合预定义的getter/setter方法
  const getter = property && property.get
  const setter = property && property.set
  // 如果这个值的属性没有getter或者有setter 且只传入obj: Object, key: string,
  if ((!getter || setter) && arguments.length === 2) {
    // val等于当前对象的key属性值
    val = obj[key]
  }
  //shadow为false 且 该值被实例化为observer 定义childOb
  let childOb = !shallow && observe(val)
  //定义getter和setter属性
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,

    get: function reactiveGetter () {

      //value值等于 将getter的this绑定到obj上调用obj或者已经观察的obj[key]属性的值
      const value = getter ? getter.call(obj) : val
      ///该值是否可以添加依赖
      if (Dep.target) {
        // 添加依赖
        dep.depend()
        // 如果有子属性
        if (childOb) {
          // 将子属性添加依赖
          childOb.dep.depend()
          //如果是数组，添加数组依赖
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      //如果这个属性存在而且有getter 将 将getter的this指向obj 调用getter并且传入obj 或者 存在getter的obj[key]
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      //如果新的值等于旧的值， 或者新的值不等于新的值，旧的值不等于旧的值 返回
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      // 如果在生产环境 且用户赋值
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      //如果有getter没有setter属性也需要返回
      if (getter && !setter) return
      if (setter) {
        // 有setter属性通过setter属性赋值
        setter.call(obj, newVal)
      } else {
        //或者将新的值给 val变量
        val = newVal
      }
      //子对象等于非shadow 且 对新值进行实例化，收集依赖
      childOb = !shallow && observe(newVal)
      //通知更新
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */

// 在对象上设置属性。添加新属性，如果属性不存在，则触发更改通知。
//重写set Vue.set 为新增元素删除元素提供方法
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
//重写del Vue.del 为删除元素提供方法
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */

// 当触及数组时，收集数组元素的依赖项，因为我们不能像属性 getter 那样拦截数组元素访问。
//Vue.dependArray 当新增数组属性时
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
