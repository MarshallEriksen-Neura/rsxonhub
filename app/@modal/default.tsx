/**
 * @modal 并行插槽的默认回退。
 * 非拦截路由(以及刷新/直接访问)时该插槽渲染 null,不显示任何弹窗。
 */
export default function ModalDefault() {
  return null;
}
