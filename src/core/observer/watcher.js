/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 */
// 观察者解析表达式，收集依赖项，
// 并在表达式值更改时（set）触发回调。这用于 $watch () api 和指令。
//谁用到数据，谁就是依赖，我们就为谁创建一个Watcher实例
//一个dep数据对应一个dep,对应多个依赖，对应多个observer实例

//当数据发生变化时，会触发数据的setter，在setter中调用dep.notify()方法
//在dep.notify()方法中，遍历所有依赖（即watcher实例），执行依赖的update方法
//也就是watcher类中的 update（） 实例方法，在update() 方法中调用数据变化
//的更新回调函数。更新视图
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  //观察者只有一个，判断当前值是否需要深入观察
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  //依赖
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  // newDepIds 存储现有的被依赖值 id
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component,
    expOrFn: string | Function,
    //返回的值是一个function对象
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm
    if (isRenderWatcher) {
      vm._watcher = this
    }
    vm._watchers.push(this)
    // options
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
      this.before = options.before
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    //懒观察的值
    this.dirty = this.lazy // for lazy watchers
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production' ? expOrFn.toString() : ''
    // parse expression for getter
    //Getter 分析表达式
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      //将解析路径obj.a.c的真实值 解析出来 返回值的obj
      //给getter
      this.getter = parsePath(expOrFn)
      //如果没有解析到值
      if (!this.getter) {
        //将getter赋给noop
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    this.value = this.lazy ? undefined : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  //当实例化watcher时，先执行其构造函数，
  //构造函数中调用this.get()实例
  // 评估 getter，并重新收集依赖项。
  get () {
    //给目标值添加依赖
    //把实例自身赋给全局的唯一一个对象window.target上
    pushTarget(this)
    let value
    // 将当前 vm 被依赖数据，赋给vm变量
    const vm = this.vm
    try {
      //将getter绑定到vm上，传入vm进行调用 获取vm的值
      //获取被依赖数据，触发该数据上面的getter
      //getter会调用dep.depend收集依赖
      //而在dep.depend中取到挂载在window.target上的值
      // 并将其存入依赖数组中，在get()方法最后将window.target释放掉
      value = this.getter.call(vm, vm)
    } catch (e) {
      //如果user内有值
      if (this.user) {
        //处理错误信息，抛出错误
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
    // “touch”每一个属性，所以他们都被跟踪作为依赖深入观察
      if (this.deep) {
        //深入对对象或者数组进行深度递归遍历
        traverse(value)
      }
      //添加目标值
      popTarget()
      //清空依赖
      this.cleanupDeps()
    }
    //返回这个值
    return value
  }

  /**
   * Add a dependency to this directive.
   */
  // 给这个指令添加一个依赖项。 如果没有这个数据，新建一个依赖项
  addDep (dep: Dep) {
    //获取dep.id给id
    const id = dep.id
    //如果当前新观察依赖id没有这个id。给新的依赖id添加依赖
    // 被depsId不存在这个id值，给依赖subs内添加这个id
    if (!this.newDepIds.has(id)) {
      //那么给这个id添加一个id
      this.newDepIds.add(id)
      //给newsDeps 中的set数组添加这个依赖数组
      this.newDeps.push(dep)
      //如果depIds里没有这个id值
      if (!this.depIds.has(id)){
        //将当前值添加到被依赖数组subs内
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   */
  // 清理依赖性收集。
  cleanupDeps () {
    //知道依赖的长度
    let i = this.deps.length
    //遍历依赖 收集依赖
    while (i--) {
      //将dep赋给deps[i]
      const dep = this.deps[i]
      //如果dep.id不在newDepIds内
      if (!this.newDepIds.has(dep.id)) {
        //移除当前依赖的subs内的数据
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  //当依赖关系发生变化时调用。
  update () {
    /* istanbul ignore else */
    //判断当前调用是否需要处理
    if (this.lazy) {
      this.dirty = true
      //如果它是异步的
    } else if (this.sync) {
      this.run()
    } else {
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  // 调度程序将调用调度程序作业接口。
  run () {
    if (this.active) {
      const value = this.get()
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        // 对象/数组的深度观察者和观察者应该在值相同的情况下销毁，因为值可能发生了突变。
        isObject(value) ||
        this.deep
      ) {
        // set new value
        //赋新的值 这个value给旧的value
        const oldValue = this.value
        this.value = value
        // 如果有这个user值
        if (this.user) {
          try {
            //这个值的this绑定到vm上面，传入value和oldValue
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  // 评估守望者的价值，只有懒惰的守望者才会这么做。
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  // 取决于这个观察者收集的所有数据。
  // 暴露方法，遍历deps内的长度，给deps添加依赖
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  // 从所有依赖关系的订阅者列表中删除 self。
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      // 从 vm 的观察者列表中删除 self 这是一个有点昂贵的操作，因此如果 vm 被破坏，我们跳过它。
      //如果vm没有被销毁 移除
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      //遍历依赖长度，移除依赖数组里的方法
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      //当前值处理完毕，不再进行处理
      this.active = false
    }
  }
}
