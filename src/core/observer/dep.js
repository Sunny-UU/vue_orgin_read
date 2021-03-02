/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */

// Dep 是一个可观察到的，它可以有多个订阅指令。
//每个观察者都有一个Dep实例，subs内存放其中的依赖

// 谁用到了数据 谁就是依赖 就为谁创建一个watcher实例
// 数据发生变化后，我们不去通知依赖更新，而是通知依赖对应的watcher实例哦，
// 由watcher去通知真正的视图
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++
    this.subs = []
  }
  //为值新建依赖数组
  addSub (sub: Watcher) {
    this.subs.push(sub)
  }
  //为值移除依赖数组
  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }
  //添加 目标 依赖
  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }
  //通知发生变化
  notify () {
    // stabilize the subscriber list first
    const subs = this.subs.slice()
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      subs.sort((a, b) => a.id - b.id)
    }
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.


// 目前正在评估的目标观察者。这是全局唯一的，因为一次只能有一个观察者。

Dep.target = null
const targetStack = []

//给正在评估的观察者添加依赖
export function pushTarget (target: ?Watcher) {
  //将目标值存储发哦目标栈内
  targetStack.push(target)
  // 给目标值添加依赖
  Dep.target = target
}

//添加 目标观察值
export function popTarget () {
  targetStack.pop()
  //对目标观察值栈里面最后一个值进行收集依赖
  Dep.target = targetStack[targetStack.length - 1]
}
